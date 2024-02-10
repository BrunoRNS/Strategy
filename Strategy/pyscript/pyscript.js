var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a &amp;&amp; typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx &lt; dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i &lt; render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment &amp;&amp; $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block &amp;&amp; block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block &amp;&amp; block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() =&gt; {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block &amp;&amp; block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment &amp;&amp; fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() =&gt; {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment &amp;&amp; $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 &lt;&lt; (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles &amp;&amp; append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) =&gt; {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx &amp;&amp; not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound &amp;&amp; $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment &amp;&amp; $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment &amp;&amp; $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () =&gt; {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set &amp;&amp; !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src/Tailwind.svelte generated by Svelte v3.48.0 */

    class Tailwind extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.48.0 */

    function create_fragment(ctx) {
    	let tailwind;
    	let current;
    	tailwind = new Tailwind({});

    	return {
    		c() {
    			create_component(tailwind.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(tailwind, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(tailwind.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(tailwind.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(tailwind, detaching);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i &lt; subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () =&gt; {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const pyodideLoaded = writable({
        loaded: false,
        premise: null,
    });
    const loadedEnvironments = writable([{}]);
    const DEFAULT_MODE = 'play';
    const componentDetailsNavOpen = writable(false);
    const mode = writable(DEFAULT_MODE);
    const scriptsQueue = writable([]);
    const initializers = writable([]);
    const postInitializers = writable([]);
    const globalLoader = writable();
    const appConfig = writable();
    let scriptsQueue_$1 = [];
    let initializers_$1 = [];
    let postInitializers_$1 = [];
    scriptsQueue.subscribe(value =&gt; {
        scriptsQueue_$1 = value;
    });
    const addToScriptsQueue = (script) =&gt; {
        scriptsQueue.set([...scriptsQueue_$1, script]);
    };
    initializers.subscribe(value =&gt; {
        initializers_$1 = value;
    });
    const addInitializer = (initializer) =&gt; {
        console.log('adding initializer', initializer);
        initializers.set([...initializers_$1, initializer]);
        console.log('adding initializer', initializer);
    };
    postInitializers.subscribe(value =&gt; {
        postInitializers_$1 = value;
    });
    const addPostInitializer = (initializer) =&gt; {
        console.log('adding post initializer', initializer);
        postInitializers.set([...postInitializers_$1, initializer]);
        console.log('adding post initializer', initializer);
    };

    function addClasses(element, classes) {
        for (const entry of classes) {
            element.classList.add(entry);
        }
    }
    function removeClasses(element, classes) {
        for (const entry of classes) {
            element.classList.remove(entry);
        }
    }
    function getLastPath(str) {
        return str.split('\\').pop().split('/').pop();
    }
    function htmlDecode(input) {
        const doc = new DOMParser().parseFromString(ltrim(input), 'text/html');
        return doc.documentElement.textContent;
    }
    function ltrim(code) {
        const lines = code.split('\n');
        if (lines.length == 0)
            return code;
        const lengths = lines
            .filter(line =&gt; line.trim().length != 0)
            .map(line =&gt; {
            const [prefix] = line.match(/^\s*/);
            return prefix.length;
        });
        const k = Math.min(...lengths);
        if (k != 0)
            return lines.map(line =&gt; line.substring(k)).join('\n');
        else
            return code;
    }
    function guidGenerator() {
        const S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4();
    }
    /*
     *  Display a page-wide error message to show that something has gone wrong with
     *  PyScript or Pyodide during loading. Probably not be used for issues that occur within
     *  Python scripts, since stderr can be routed to somewhere in the DOM
     */
    function showError(msg) {
        const warning = document.createElement('div');
        warning.style.backgroundColor = 'LightCoral';
        warning.style.alignContent = 'center';
        warning.style.margin = '4px';
        warning.style.padding = '4px';
        warning.innerHTML = msg;
        document.body.prepend(warning);
    }
    function handleFetchError(e, singleFile) {
        //Should we still export full error contents to console?
        console.warn('Caught an error in loadPaths:\r\n' + e);
        let errorContent;
        if (e.message.includes('TypeError: Failed to fetch')) {
            errorContent = `&lt;p&gt;PyScript: Access to local files
        (using "Paths:" in &amp;lt;py-env&amp;gt;)
        is not available when directly opening a HTML file;
        you must use a webserver to serve the additional files.
        See &lt;a style="text-decoration: underline;" href="https://github.com/pyscript/pyscript/issues/257#issuecomment-1119595062"&gt;this reference&lt;/a&gt;
        on starting a simple webserver with Python.&lt;/p&gt;`;
        }
        else if (e.message.includes('404')) {
            errorContent =
                `&lt;p&gt;PyScript: Loading from file &lt;u&gt;` +
                    singleFile +
                    `&lt;/u&gt; failed with error 404 (File not Found). Are your filename and path are correct?&lt;/p&gt;`;
        }
        else {
            errorContent =
                '&lt;p&gt;PyScript encountered an error while loading from file: ' + e.message + '&lt;/p&gt;';
        }
        showError(errorContent);
    }

    // Premise used to connect to the first available pyodide interpreter
    let runtime$1;
    let Element;
    pyodideLoaded.subscribe(value =&gt; {
        runtime$1 = value;
    });
    loadedEnvironments.subscribe(value =&gt; {
    });
    mode.subscribe(value =&gt; {
    });
    class BaseEvalElement extends HTMLElement {
        constructor() {
            super();
            // attach shadow so we can preserve the element original innerHtml content
            this.shadow = this.attachShadow({ mode: 'open' });
            this.wrapper = document.createElement('slot');
            this.shadow.appendChild(this.wrapper);
        }
        addToOutput(s) {
            this.outputElement.innerHTML += '&lt;div&gt;' + s + '&lt;/div&gt;';
            this.outputElement.hidden = false;
        }
        // subclasses should overwrite this method to define custom logic
        // after code has been evaluated
        postEvaluate() {
            return null;
        }
        checkId() {
            if (!this.id)
                this.id = 'py-' + guidGenerator();
        }
        getSourceFromElement() {
            return '';
        }
        async getSourceFromFile(s) {
            const response = await fetch(s);
            this.code = await response.text();
            return this.code;
        }
        async _register_esm(pyodide) {
            const imports = {};
            for (const node of document.querySelectorAll("script[type='importmap']")) {
                const importmap = (() =&gt; {
                    try {
                        return JSON.parse(node.textContent);
                    }
                    catch (_a) {
                        return null;
                    }
                })();
                if ((importmap === null || importmap === void 0 ? void 0 : importmap.imports) == null)
                    continue;
                for (const [name, url] of Object.entries(importmap.imports)) {
                    if (typeof name != 'string' || typeof url != 'string')
                        continue;
                    try {
                        // XXX: pyodide doesn't like Module(), failing with
                        // "can't read 'name' of undefined" at import time
                        imports[name] = Object.assign({}, (await import(url)));
                    }
                    catch (_a) {
                        console.error(`failed to fetch '${url}' for '${name}'`);
                    }
                }
            }
            pyodide.registerJsModule('esm', imports);
        }
        async evaluate() {
            console.log('evaluate');
            const pyodide = runtime$1;
            let source;
            let output;
            try {
                if (this.source) {
                    source = await this.getSourceFromFile(this.source);
                }
                else {
                    source = this.getSourceFromElement();
                }
                await this._register_esm(pyodide);
                if (source.includes('asyncio')) {
                    await pyodide.runPythonAsync(`output_manager.change("` + this.outputElement.id + `", "` + this.errorElement.id + `")`);
                    output = await pyodide.runPythonAsync(source);
                    await pyodide.runPythonAsync(`output_manager.revert()`);
                }
                else {
                    output = pyodide.runPython(`output_manager.change("` + this.outputElement.id + `", "` + this.errorElement.id + `")`);
                    output = pyodide.runPython(source);
                    pyodide.runPython(`output_manager.revert()`);
                }
                if (output !== undefined) {
                    if (Element === undefined) {
                        Element = pyodide.globals.get('Element');
                    }
                    const out = Element(this.outputElement.id);
                    out.write.callKwargs(output, { append: true });
                    this.outputElement.hidden = false;
                    this.outputElement.style.display = 'block';
                }
                // check if this REPL contains errors, delete them and remove error classes
                const errorElements = document.querySelectorAll(`div[id^='${this.errorElement.id}'][error]`);
                if (errorElements.length &gt; 0) {
                    for (const errorElement of errorElements) {
                        errorElement.classList.add('hidden');
                        if (this.hasAttribute('std-err')) {
                            this.errorElement.hidden = true;
                            this.errorElement.style.removeProperty('display');
                        }
                    }
                    removeClasses(this.errorElement, ['bg-red-200', 'p-2']);
                }
                this.postEvaluate();
            }
            catch (err) {
                if (Element === undefined) {
                    Element = pyodide.globals.get('Element');
                }
                const out = Element(this.errorElement.id);
                addClasses(this.errorElement, ['bg-red-200', 'p-2']);
                out.write.callKwargs(err, { append: true });
                this.errorElement.children[this.errorElement.children.length - 1].setAttribute('error', '');
                this.errorElement.hidden = false;
                this.errorElement.style.display = 'block';
            }
        } // end evaluate
        async eval(source) {
            let output;
            const pyodide = runtime$1;
            try {
                output = await pyodide.runPythonAsync(source);
                if (output !== undefined) {
                    console.log(output);
                }
            }
            catch (err) {
                console.log(err);
            }
        } // end eval
    }
    function createWidget(name, code, klass) {
        class CustomWidget extends HTMLElement {
            constructor() {
                super();
                this.name = name;
                this.klass = klass;
                this.code = code;
                // attach shadow so we can preserve the element original innerHtml content
                this.shadow = this.attachShadow({ mode: 'open' });
                this.wrapper = document.createElement('slot');
                this.shadow.appendChild(this.wrapper);
            }
            connectedCallback() {
                // TODO: we are calling with a 2secs delay to allow pyodide to load
                //       ideally we can just wait for it to load and then run. To do
                //       so we need to replace using the promise and actually using
                //       the interpreter after it loads completely
                // setTimeout(async () =&gt; {
                //     await this.eval(this.code);
                //     this.proxy = this.proxyClass(this);
                //     console.log('proxy', this.proxy);
                //     this.proxy.connect();
                //     this.registerWidget();
                // }, 2000);
                pyodideLoaded.subscribe(value =&gt; {
                    console.log('RUNTIME READY', value);
                    if ('runPythonAsync' in value) {
                        runtime$1 = value;
                        setTimeout(async () =&gt; {
                            await this.eval(this.code);
                            this.proxy = this.proxyClass(this);
                            console.log('proxy', this.proxy);
                            this.proxy.connect();
                            this.registerWidget();
                        }, 1000);
                    }
                });
            }
            registerWidget() {
                const pyodide = runtime$1;
                console.log('new widget registered:', this.name);
                pyodide.globals.set(this.id, this.proxy);
            }
            async eval(source) {
                let output;
                const pyodide = runtime$1;
                try {
                    output = await pyodide.runPythonAsync(source);
                    this.proxyClass = pyodide.globals.get(this.klass);
                    if (output !== undefined) {
                        console.log(output);
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
        customElements.define(name, CustomWidget);
    }
    class PyWidget extends HTMLElement {
        constructor() {
            super();
            // attach shadow so we can preserve the element original innerHtml content
            this.shadow = this.attachShadow({ mode: 'open' });
            this.wrapper = document.createElement('slot');
            this.shadow.appendChild(this.wrapper);
            if (this.hasAttribute('src')) {
                this.source = this.getAttribute('src');
            }
            if (this.hasAttribute('name')) {
                this.name = this.getAttribute('name');
            }
            if (this.hasAttribute('klass')) {
                this.klass = this.getAttribute('klass');
            }
        }
        async connectedCallback() {
            if (this.id === undefined) {
                throw new ReferenceError(`No id specified for component. Components must have an explicit id. Please use id="" to specify your component id.`);
            }
            const mainDiv = document.createElement('div');
            mainDiv.id = this.id + '-main';
            this.appendChild(mainDiv);
            console.log('reading source');
            this.code = await this.getSourceFromFile(this.source);
            createWidget(this.name, this.code, this.klass);
        }
        initOutErr() {
            if (this.hasAttribute('output')) {
                this.errorElement = this.outputElement = document.getElementById(this.getAttribute('output'));
                // in this case, the default output-mode is append, if hasn't been specified
                if (!this.hasAttribute('output-mode')) {
                    this.setAttribute('output-mode', 'append');
                }
            }
            else {
                if (this.hasAttribute('std-out')) {
                    this.outputElement = document.getElementById(this.getAttribute('std-out'));
                }
                else {
                    // In this case neither output or std-out have been provided so we need
                    // to create a new output div to output to
                    this.outputElement = document.createElement('div');
                    this.outputElement.classList.add('output');
                    this.outputElement.hidden = true;
                    this.outputElement.id = this.id + '-' + this.getAttribute('exec-id');
                }
                if (this.hasAttribute('std-err')) {
                    this.errorElement = document.getElementById(this.getAttribute('std-err'));
                }
                else {
                    this.errorElement = this.outputElement;
                }
            }
        }
        async getSourceFromFile(s) {
            const response = await fetch(s);
            return await response.text();
        }
        async eval(source) {
            let output;
            const pyodide = runtime$1;
            try {
                output = await pyodide.runPythonAsync(source);
                if (output !== undefined) {
                    console.log(output);
                }
            }
            catch (err) {
                console.log(err);
            }
        }
    }

    // Premise used to connect to the first available pyodide interpreter
    let pyodideReadyPromise$1;
    let currentMode;
    pyodideLoaded.subscribe(value =&gt; {
        pyodideReadyPromise$1 = value;
    });
    loadedEnvironments.subscribe(value =&gt; {
    });
    mode.subscribe(value =&gt; {
        currentMode = value;
    });
    class PyScript extends BaseEvalElement {
        constructor() {
            super();
            // add an extra div where we can attach the codemirror editor
            this.shadow.appendChild(this.wrapper);
        }
        connectedCallback() {
            this.checkId();
            this.code = this.innerHTML;
            this.innerHTML = '';
            const mainDiv = document.createElement('div');
            addClasses(mainDiv, ['parentBox', 'flex', 'flex-col', 'mx-8']);
            // add Editor to main PyScript div
            if (this.hasAttribute('output')) {
                this.errorElement = this.outputElement = document.getElementById(this.getAttribute('output'));
                // in this case, the default output-mode is append, if hasn't been specified
                if (!this.hasAttribute('output-mode')) {
                    this.setAttribute('output-mode', 'append');
                }
            }
            else {
                if (this.hasAttribute('std-out')) {
                    this.outputElement = document.getElementById(this.getAttribute('std-out'));
                }
                else {
                    // In this case neither output or std-out have been provided so we need
                    // to create a new output div to output to
                    // Let's check if we have an id first and create one if not
                    this.outputElement = document.createElement('div');
                    const exec_id = this.getAttribute('exec-id');
                    this.outputElement.id = this.id + (exec_id ? '-' + exec_id : '');
                    // add the output div id if there's not output pre-defined
                    mainDiv.appendChild(this.outputElement);
                }
                if (this.hasAttribute('std-err')) {
                    this.errorElement = document.getElementById(this.getAttribute('std-err'));
                }
                else {
                    this.errorElement = this.outputElement;
                }
            }
            if (currentMode == 'edit') {
                // TODO: We need to build a plan for this
                this.appendChild(mainDiv);
            }
            else {
                this.appendChild(mainDiv);
                addToScriptsQueue(this);
            }
            console.log('connected');
            if (this.hasAttribute('src')) {
                this.source = this.getAttribute('src');
            }
        }
        async _register_esm(pyodide) {
            for (const node of document.querySelectorAll("script[type='importmap']")) {
                const importmap = (() =&gt; {
                    try {
                        return JSON.parse(node.textContent);
                    }
                    catch (_a) {
                        return null;
                    }
                })();
                if ((importmap === null || importmap === void 0 ? void 0 : importmap.imports) == null)
                    continue;
                for (const [name, url] of Object.entries(importmap.imports)) {
                    if (typeof name != 'string' || typeof url != 'string')
                        continue;
                    let exports;
                    try {
                        // XXX: pyodide doesn't like Module(), failing with
                        // "can't read 'name' of undefined" at import time
                        exports = Object.assign({}, (await import(url)));
                    }
                    catch (_a) {
                        console.warn(`failed to fetch '${url}' for '${name}'`);
                        continue;
                    }
                    pyodide.registerJsModule(name, exports);
                }
            }
        }
        getSourceFromElement() {
            return htmlDecode(this.code);
        }
    }
    /** Defines all possible pys-on* and their corresponding event types  */
    const pysAttributeToEvent = new Map([
        ["pys-onClick", "click"],
        ["pys-onKeyDown", "keydown"]
    ]);
    /** Initialize all elements with pys-on* handlers attributes  */
    async function initHandlers() {
        console.log('Collecting nodes...');
        const pyodide = await pyodideReadyPromise$1;
        for (const pysAttribute of pysAttributeToEvent.keys()) {
            await createElementsWithEventListeners(pyodide, pysAttribute);
        }
    }
    /** Initializes an element with the given pys-on* attribute and its handler */
    async function createElementsWithEventListeners(pyodide, pysAttribute) {
        const matches = document.querySelectorAll(`[${pysAttribute}]`);
        for (const el of matches) {
            if (el.id.length === 0) {
                throw new TypeError(`&lt;${el.tagName.toLowerCase()}&gt; must have an id attribute, when using the ${pysAttribute} attribute`);
            }
            const handlerCode = el.getAttribute(pysAttribute);
            const event = pysAttributeToEvent.get(pysAttribute);
            const source = `
        from pyodide import create_proxy
        Element("${el.id}").element.addEventListener("${event}",  create_proxy(${handlerCode}))
        `;
            await pyodide.runPythonAsync(source);
            // TODO: Should we actually map handlers in JS instead of Python?
            // el.onclick = (evt: any) =&gt; {
            //   console.log("click");
            //   new Promise((resolve, reject) =&gt; {
            //     setTimeout(() =&gt; {
            //       console.log('Inside')
            //     }, 300);
            //   }).then(() =&gt; {
            //     console.log("resolved")
            //   });
            //   // let handlerCode = el.getAttribute('pys-onClick');
            //   // pyodide.runPython(handlerCode);
            // }
        }
    }
    /** Mount all elements with attribute py-mount into the Python namespace */
    async function mountElements() {
        console.log('Collecting nodes to be mounted into python namespace...');
        const pyodide = await pyodideReadyPromise$1;
        const matches = document.querySelectorAll('[py-mount]');
        let source = '';
        for (const el of matches) {
            const mountName = el.getAttribute('py-mount') || el.id.split('-').join('_');
            source += `\n${mountName} = Element("${el.id}")`;
        }
        await pyodide.runPythonAsync(source);
    }
    addInitializer(mountElements);
    addPostInitializer(initHandlers);

    // Compressed representation of the Grapheme_Cluster_Break=Extend
    // information from
    // http://www.unicode.org/Public/13.0.0/ucd/auxiliary/GraphemeBreakProperty.txt.
    // Each pair of elements represents a range, as an offet from the
    // previous range and a length. Numbers are in base-36, with the empty
    // string being a shorthand for 1.
    let extend$1 = /*@__PURE__*/"lc,34,7n,7,7b,19,,,,2,,2,,,20,b,1c,l,g,,2t,7,2,6,2,2,,4,z,,u,r,2j,b,1m,9,9,,o,4,,9,,3,,5,17,3,3b,f,,w,1j,,,,4,8,4,,3,7,a,2,t,,1m,,,,2,4,8,,9,,a,2,q,,2,2,1l,,4,2,4,2,2,3,3,,u,2,3,,b,2,1l,,4,5,,2,4,,k,2,m,6,,,1m,,,2,,4,8,,7,3,a,2,u,,1n,,,,c,,9,,14,,3,,1l,3,5,3,,4,7,2,b,2,t,,1m,,2,,2,,3,,5,2,7,2,b,2,s,2,1l,2,,,2,4,8,,9,,a,2,t,,20,,4,,2,3,,,8,,29,,2,7,c,8,2q,,2,9,b,6,22,2,r,,,,,,1j,e,,5,,2,5,b,,10,9,,2u,4,,6,,2,2,2,p,2,4,3,g,4,d,,2,2,6,,f,,jj,3,qa,3,t,3,t,2,u,2,1s,2,,7,8,,2,b,9,,19,3,3b,2,y,,3a,3,4,2,9,,6,3,63,2,2,,1m,,,7,,,,,2,8,6,a,2,,1c,h,1r,4,1c,7,,,5,,14,9,c,2,w,4,2,2,,3,1k,,,2,3,,,3,1m,8,2,2,48,3,,d,,7,4,,6,,3,2,5i,1m,,5,ek,,5f,x,2da,3,3x,,2o,w,fe,6,2x,2,n9w,4,,a,w,2,28,2,7k,,3,,4,,p,2,5,,47,2,q,i,d,,12,8,p,b,1a,3,1c,,2,4,2,2,13,,1v,6,2,2,2,2,c,,8,,1b,,1f,,,3,2,2,5,2,,,16,2,8,,6m,,2,,4,,fn4,,kh,g,g,g,a6,2,gt,,6a,,45,5,1ae,3,,2,5,4,14,3,4,,4l,2,fx,4,ar,2,49,b,4w,,1i,f,1k,3,1d,4,2,2,1x,3,10,5,,8,1q,,c,2,1g,9,a,4,2,,2n,3,2,,,2,6,,4g,,3,8,l,2,1l,2,,,,,m,,e,7,3,5,5f,8,2,3,,,n,,29,,2,6,,,2,,,2,,2,6j,,2,4,6,2,,2,r,2,2d,8,2,,,2,2y,,,,2,6,,,2t,3,2,4,,5,77,9,,2,6t,,a,2,,,4,,40,4,2,2,4,,w,a,14,6,2,4,8,,9,6,2,3,1a,d,,2,ba,7,,6,,,2a,m,2,7,,2,,2,3e,6,3,,,2,,7,,,20,2,3,,,,9n,2,f0b,5,1n,7,t4,,1r,4,29,,f5k,2,43q,,,3,4,5,8,8,2,7,u,4,44,3,1iz,1j,4,1e,8,,e,,m,5,,f,11s,7,,h,2,7,,2,,5,79,7,c5,4,15s,7,31,7,240,5,gx7k,2o,3k,6o".split(",").map(s =&gt; s ? parseInt(s, 36) : 1);
    // Convert offsets into absolute values
    for (let i = 1; i &lt; extend$1.length; i++)
        extend$1[i] += extend$1[i - 1];
    function isExtendingChar(code) {
        for (let i = 1; i &lt; extend$1.length; i += 2)
            if (extend$1[i] &gt; code)
                return extend$1[i - 1] &lt;= code;
        return false;
    }
    function isRegionalIndicator(code) {
        return code &gt;= 0x1F1E6 &amp;&amp; code &lt;= 0x1F1FF;
    }
    const ZWJ = 0x200d;
    /**
    Returns a next grapheme cluster break _after_ (not equal to)
    `pos`, if `forward` is true, or before otherwise. Returns `pos`
    itself if no further cluster break is available in the string.
    Moves across surrogate pairs, extending characters (when
    `includeExtending` is true), characters joined with zero-width
    joiners, and flag emoji.
    */
    function findClusterBreak(str, pos, forward = true, includeExtending = true) {
        return (forward ? nextClusterBreak : prevClusterBreak)(str, pos, includeExtending);
    }
    function nextClusterBreak(str, pos, includeExtending) {
        if (pos == str.length)
            return pos;
        // If pos is in the middle of a surrogate pair, move to its start
        if (pos &amp;&amp; surrogateLow(str.charCodeAt(pos)) &amp;&amp; surrogateHigh(str.charCodeAt(pos - 1)))
            pos--;
        let prev = codePointAt(str, pos);
        pos += codePointSize(prev);
        while (pos &lt; str.length) {
            let next = codePointAt(str, pos);
            if (prev == ZWJ || next == ZWJ || includeExtending &amp;&amp; isExtendingChar(next)) {
                pos += codePointSize(next);
                prev = next;
            }
            else if (isRegionalIndicator(next)) {
                let countBefore = 0, i = pos - 2;
                while (i &gt;= 0 &amp;&amp; isRegionalIndicator(codePointAt(str, i))) {
                    countBefore++;
                    i -= 2;
                }
                if (countBefore % 2 == 0)
                    break;
                else
                    pos += 2;
            }
            else {
                break;
            }
        }
        return pos;
    }
    function prevClusterBreak(str, pos, includeExtending) {
        while (pos &gt; 0) {
            let found = nextClusterBreak(str, pos - 2, includeExtending);
            if (found &lt; pos)
                return found;
            pos--;
        }
        return 0;
    }
    function surrogateLow(ch) { return ch &gt;= 0xDC00 &amp;&amp; ch &lt; 0xE000; }
    function surrogateHigh(ch) { return ch &gt;= 0xD800 &amp;&amp; ch &lt; 0xDC00; }
    /**
    Find the code point at the given position in a string (like the
    [`codePointAt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)
    string method).
    */
    function codePointAt(str, pos) {
        let code0 = str.charCodeAt(pos);
        if (!surrogateHigh(code0) || pos + 1 == str.length)
            return code0;
        let code1 = str.charCodeAt(pos + 1);
        if (!surrogateLow(code1))
            return code0;
        return ((code0 - 0xd800) &lt;&lt; 10) + (code1 - 0xdc00) + 0x10000;
    }
    /**
    Given a Unicode codepoint, return the JavaScript string that
    respresents it (like
    [`String.fromCodePoint`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint)).
    */
    function fromCodePoint(code) {
        if (code &lt;= 0xffff)
            return String.fromCharCode(code);
        code -= 0x10000;
        return String.fromCharCode((code &gt;&gt; 10) + 0xd800, (code &amp; 1023) + 0xdc00);
    }
    /**
    The first character that takes up two positions in a JavaScript
    string. It is often useful to compare with this after calling
    `codePointAt`, to figure out whether your character takes up 1 or
    2 index positions.
    */
    function codePointSize(code) { return code &lt; 0x10000 ? 1 : 2; }

    /**
    Count the column position at the given offset into the string,
    taking extending characters and tab size into account.
    */
    function countColumn(string, tabSize, to = string.length) {
        let n = 0;
        for (let i = 0; i &lt; to;) {
            if (string.charCodeAt(i) == 9) {
                n += tabSize - (n % tabSize);
                i++;
            }
            else {
                n++;
                i = findClusterBreak(string, i);
            }
        }
        return n;
    }
    /**
    Find the offset that corresponds to the given column position in a
    string, taking extending characters and tab size into account. By
    default, the string length is returned when it is too short to
    reach the column. Pass `strict` true to make it return -1 in that
    situation.
    */
    function findColumn(string, col, tabSize, strict) {
        for (let i = 0, n = 0;;) {
            if (n &gt;= col)
                return i;
            if (i == string.length)
                break;
            n += string.charCodeAt(i) == 9 ? tabSize - (n % tabSize) : 1;
            i = findClusterBreak(string, i);
        }
        return strict === true ? -1 : string.length;
    }

    /**
    The data structure for documents.
    */
    class Text {
        /**
        @internal
        */
        constructor() { }
        /**
        Get the line description around the given position.
        */
        lineAt(pos) {
            if (pos &lt; 0 || pos &gt; this.length)
                throw new RangeError(`Invalid position ${pos} in document of length ${this.length}`);
            return this.lineInner(pos, false, 1, 0);
        }
        /**
        Get the description for the given (1-based) line number.
        */
        line(n) {
            if (n &lt; 1 || n &gt; this.lines)
                throw new RangeError(`Invalid line number ${n} in ${this.lines}-line document`);
            return this.lineInner(n, true, 1, 0);
        }
        /**
        Replace a range of the text with the given content.
        */
        replace(from, to, text) {
            let parts = [];
            this.decompose(0, from, parts, 2 /* To */);
            if (text.length)
                text.decompose(0, text.length, parts, 1 /* From */ | 2 /* To */);
            this.decompose(to, this.length, parts, 1 /* From */);
            return TextNode.from(parts, this.length - (to - from) + text.length);
        }
        /**
        Append another document to this one.
        */
        append(other) {
            return this.replace(this.length, this.length, other);
        }
        /**
        Retrieve the text between the given points.
        */
        slice(from, to = this.length) {
            let parts = [];
            this.decompose(from, to, parts, 0);
            return TextNode.from(parts, to - from);
        }
        /**
        Test whether this text is equal to another instance.
        */
        eq(other) {
            if (other == this)
                return true;
            if (other.length != this.length || other.lines != this.lines)
                return false;
            let start = this.scanIdentical(other, 1), end = this.length - this.scanIdentical(other, -1);
            let a = new RawTextCursor(this), b = new RawTextCursor(other);
            for (let skip = start, pos = start;;) {
                a.next(skip);
                b.next(skip);
                skip = 0;
                if (a.lineBreak != b.lineBreak || a.done != b.done || a.value != b.value)
                    return false;
                pos += a.value.length;
                if (a.done || pos &gt;= end)
                    return true;
            }
        }
        /**
        Iterate over the text. When `dir` is `-1`, iteration happens
        from end to start. This will return lines and the breaks between
        them as separate strings, and for long lines, might split lines
        themselves into multiple chunks as well.
        */
        iter(dir = 1) { return new RawTextCursor(this, dir); }
        /**
        Iterate over a range of the text. When `from` &gt; `to`, the
        iterator will run in reverse.
        */
        iterRange(from, to = this.length) { return new PartialTextCursor(this, from, to); }
        /**
        Return a cursor that iterates over the given range of lines,
        _without_ returning the line breaks between, and yielding empty
        strings for empty lines.
        
        When `from` and `to` are given, they should be 1-based line numbers.
        */
        iterLines(from, to) {
            let inner;
            if (from == null) {
                inner = this.iter();
            }
            else {
                if (to == null)
                    to = this.lines + 1;
                let start = this.line(from).from;
                inner = this.iterRange(start, Math.max(start, to == this.lines + 1 ? this.length : to &lt;= 1 ? 0 : this.line(to - 1).to));
            }
            return new LineCursor(inner);
        }
        /**
        @internal
        */
        toString() { return this.sliceString(0); }
        /**
        Convert the document to an array of lines (which can be
        deserialized again via [`Text.of`](https://codemirror.net/6/docs/ref/#text.Text^of)).
        */
        toJSON() {
            let lines = [];
            this.flatten(lines);
            return lines;
        }
        /**
        Create a `Text` instance for the given array of lines.
        */
        static of(text) {
            if (text.length == 0)
                throw new RangeError("A document must have at least one line");
            if (text.length == 1 &amp;&amp; !text[0])
                return Text.empty;
            return text.length &lt;= 32 /* Branch */ ? new TextLeaf(text) : TextNode.from(TextLeaf.split(text, []));
        }
    }
    // Leaves store an array of line strings. There are always line breaks
    // between these strings. Leaves are limited in size and have to be
    // contained in TextNode instances for bigger documents.
    class TextLeaf extends Text {
        constructor(text, length = textLength(text)) {
            super();
            this.text = text;
            this.length = length;
        }
        get lines() { return this.text.length; }
        get children() { return null; }
        lineInner(target, isLine, line, offset) {
            for (let i = 0;; i++) {
                let string = this.text[i], end = offset + string.length;
                if ((isLine ? line : end) &gt;= target)
                    return new Line(offset, end, line, string);
                offset = end + 1;
                line++;
            }
        }
        decompose(from, to, target, open) {
            let text = from &lt;= 0 &amp;&amp; to &gt;= this.length ? this
                : new TextLeaf(sliceText(this.text, from, to), Math.min(to, this.length) - Math.max(0, from));
            if (open &amp; 1 /* From */) {
                let prev = target.pop();
                let joined = appendText(text.text, prev.text.slice(), 0, text.length);
                if (joined.length &lt;= 32 /* Branch */) {
                    target.push(new TextLeaf(joined, prev.length + text.length));
                }
                else {
                    let mid = joined.length &gt;&gt; 1;
                    target.push(new TextLeaf(joined.slice(0, mid)), new TextLeaf(joined.slice(mid)));
                }
            }
            else {
                target.push(text);
            }
        }
        replace(from, to, text) {
            if (!(text instanceof TextLeaf))
                return super.replace(from, to, text);
            let lines = appendText(this.text, appendText(text.text, sliceText(this.text, 0, from)), to);
            let newLen = this.length + text.length - (to - from);
            if (lines.length &lt;= 32 /* Branch */)
                return new TextLeaf(lines, newLen);
            return TextNode.from(TextLeaf.split(lines, []), newLen);
        }
        sliceString(from, to = this.length, lineSep = "\n") {
            let result = "";
            for (let pos = 0, i = 0; pos &lt;= to &amp;&amp; i &lt; this.text.length; i++) {
                let line = this.text[i], end = pos + line.length;
                if (pos &gt; from &amp;&amp; i)
                    result += lineSep;
                if (from &lt; end &amp;&amp; to &gt; pos)
                    result += line.slice(Math.max(0, from - pos), to - pos);
                pos = end + 1;
            }
            return result;
        }
        flatten(target) {
            for (let line of this.text)
                target.push(line);
        }
        scanIdentical() { return 0; }
        static split(text, target) {
            let part = [], len = -1;
            for (let line of text) {
                part.push(line);
                len += line.length + 1;
                if (part.length == 32 /* Branch */) {
                    target.push(new TextLeaf(part, len));
                    part = [];
                    len = -1;
                }
            }
            if (len &gt; -1)
                target.push(new TextLeaf(part, len));
            return target;
        }
    }
    // Nodes provide the tree structure of the `Text` type. They store a
    // number of other nodes or leaves, taking care to balance themselves
    // on changes. There are implied line breaks _between_ the children of
    // a node (but not before the first or after the last child).
    class TextNode extends Text {
        constructor(children, length) {
            super();
            this.children = children;
            this.length = length;
            this.lines = 0;
            for (let child of children)
                this.lines += child.lines;
        }
        lineInner(target, isLine, line, offset) {
            for (let i = 0;; i++) {
                let child = this.children[i], end = offset + child.length, endLine = line + child.lines - 1;
                if ((isLine ? endLine : end) &gt;= target)
                    return child.lineInner(target, isLine, line, offset);
                offset = end + 1;
                line = endLine + 1;
            }
        }
        decompose(from, to, target, open) {
            for (let i = 0, pos = 0; pos &lt;= to &amp;&amp; i &lt; this.children.length; i++) {
                let child = this.children[i], end = pos + child.length;
                if (from &lt;= end &amp;&amp; to &gt;= pos) {
                    let childOpen = open &amp; ((pos &lt;= from ? 1 /* From */ : 0) | (end &gt;= to ? 2 /* To */ : 0));
                    if (pos &gt;= from &amp;&amp; end &lt;= to &amp;&amp; !childOpen)
                        target.push(child);
                    else
                        child.decompose(from - pos, to - pos, target, childOpen);
                }
                pos = end + 1;
            }
        }
        replace(from, to, text) {
            if (text.lines &lt; this.lines)
                for (let i = 0, pos = 0; i &lt; this.children.length; i++) {
                    let child = this.children[i], end = pos + child.length;
                    // Fast path: if the change only affects one child and the
                    // child's size remains in the acceptable range, only update
                    // that child
                    if (from &gt;= pos &amp;&amp; to &lt;= end) {
                        let updated = child.replace(from - pos, to - pos, text);
                        let totalLines = this.lines - child.lines + updated.lines;
                        if (updated.lines &lt; (totalLines &gt;&gt; (5 /* BranchShift */ - 1)) &amp;&amp;
                            updated.lines &gt; (totalLines &gt;&gt; (5 /* BranchShift */ + 1))) {
                            let copy = this.children.slice();
                            copy[i] = updated;
                            return new TextNode(copy, this.length - (to - from) + text.length);
                        }
                        return super.replace(pos, end, updated);
                    }
                    pos = end + 1;
                }
            return super.replace(from, to, text);
        }
        sliceString(from, to = this.length, lineSep = "\n") {
            let result = "";
            for (let i = 0, pos = 0; i &lt; this.children.length &amp;&amp; pos &lt;= to; i++) {
                let child = this.children[i], end = pos + child.length;
                if (pos &gt; from &amp;&amp; i)
                    result += lineSep;
                if (from &lt; end &amp;&amp; to &gt; pos)
                    result += child.sliceString(from - pos, to - pos, lineSep);
                pos = end + 1;
            }
            return result;
        }
        flatten(target) {
            for (let child of this.children)
                child.flatten(target);
        }
        scanIdentical(other, dir) {
            if (!(other instanceof TextNode))
                return 0;
            let length = 0;
            let [iA, iB, eA, eB] = dir &gt; 0 ? [0, 0, this.children.length, other.children.length]
                : [this.children.length - 1, other.children.length - 1, -1, -1];
            for (;; iA += dir, iB += dir) {
                if (iA == eA || iB == eB)
                    return length;
                let chA = this.children[iA], chB = other.children[iB];
                if (chA != chB)
                    return length + chA.scanIdentical(chB, dir);
                length += chA.length + 1;
            }
        }
        static from(children, length = children.reduce((l, ch) =&gt; l + ch.length + 1, -1)) {
            let lines = 0;
            for (let ch of children)
                lines += ch.lines;
            if (lines &lt; 32 /* Branch */) {
                let flat = [];
                for (let ch of children)
                    ch.flatten(flat);
                return new TextLeaf(flat, length);
            }
            let chunk = Math.max(32 /* Branch */, lines &gt;&gt; 5 /* BranchShift */), maxChunk = chunk &lt;&lt; 1, minChunk = chunk &gt;&gt; 1;
            let chunked = [], currentLines = 0, currentLen = -1, currentChunk = [];
            function add(child) {
                let last;
                if (child.lines &gt; maxChunk &amp;&amp; child instanceof TextNode) {
                    for (let node of child.children)
                        add(node);
                }
                else if (child.lines &gt; minChunk &amp;&amp; (currentLines &gt; minChunk || !currentLines)) {
                    flush();
                    chunked.push(child);
                }
                else if (child instanceof TextLeaf &amp;&amp; currentLines &amp;&amp;
                    (last = currentChunk[currentChunk.length - 1]) instanceof TextLeaf &amp;&amp;
                    child.lines + last.lines &lt;= 32 /* Branch */) {
                    currentLines += child.lines;
                    currentLen += child.length + 1;
                    currentChunk[currentChunk.length - 1] = new TextLeaf(last.text.concat(child.text), last.length + 1 + child.length);
                }
                else {
                    if (currentLines + child.lines &gt; chunk)
                        flush();
                    currentLines += child.lines;
                    currentLen += child.length + 1;
                    currentChunk.push(child);
                }
            }
            function flush() {
                if (currentLines == 0)
                    return;
                chunked.push(currentChunk.length == 1 ? currentChunk[0] : TextNode.from(currentChunk, currentLen));
                currentLen = -1;
                currentLines = currentChunk.length = 0;
            }
            for (let child of children)
                add(child);
            flush();
            return chunked.length == 1 ? chunked[0] : new TextNode(chunked, length);
        }
    }
    Text.empty = /*@__PURE__*/new TextLeaf([""], 0);
    function textLength(text) {
        let length = -1;
        for (let line of text)
            length += line.length + 1;
        return length;
    }
    function appendText(text, target, from = 0, to = 1e9) {
        for (let pos = 0, i = 0, first = true; i &lt; text.length &amp;&amp; pos &lt;= to; i++) {
            let line = text[i], end = pos + line.length;
            if (end &gt;= from) {
                if (end &gt; to)
                    line = line.slice(0, to - pos);
                if (pos &lt; from)
                    line = line.slice(from - pos);
                if (first) {
                    target[target.length - 1] += line;
                    first = false;
                }
                else
                    target.push(line);
            }
            pos = end + 1;
        }
        return target;
    }
    function sliceText(text, from, to) {
        return appendText(text, [""], from, to);
    }
    class RawTextCursor {
        constructor(text, dir = 1) {
            this.dir = dir;
            this.done = false;
            this.lineBreak = false;
            this.value = "";
            this.nodes = [text];
            this.offsets = [dir &gt; 0 ? 1 : (text instanceof TextLeaf ? text.text.length : text.children.length) &lt;&lt; 1];
        }
        nextInner(skip, dir) {
            this.done = this.lineBreak = false;
            for (;;) {
                let last = this.nodes.length - 1;
                let top = this.nodes[last], offsetValue = this.offsets[last], offset = offsetValue &gt;&gt; 1;
                let size = top instanceof TextLeaf ? top.text.length : top.children.length;
                if (offset == (dir &gt; 0 ? size : 0)) {
                    if (last == 0) {
                        this.done = true;
                        this.value = "";
                        return this;
                    }
                    if (dir &gt; 0)
                        this.offsets[last - 1]++;
                    this.nodes.pop();
                    this.offsets.pop();
                }
                else if ((offsetValue &amp; 1) == (dir &gt; 0 ? 0 : 1)) {
                    this.offsets[last] += dir;
                    if (skip == 0) {
                        this.lineBreak = true;
                        this.value = "\n";
                        return this;
                    }
                    skip--;
                }
                else if (top instanceof TextLeaf) {
                    // Move to the next string
                    let next = top.text[offset + (dir &lt; 0 ? -1 : 0)];
                    this.offsets[last] += dir;
                    if (next.length &gt; Math.max(0, skip)) {
                        this.value = skip == 0 ? next : dir &gt; 0 ? next.slice(skip) : next.slice(0, next.length - skip);
                        return this;
                    }
                    skip -= next.length;
                }
                else {
                    let next = top.children[offset + (dir &lt; 0 ? -1 : 0)];
                    if (skip &gt; next.length) {
                        skip -= next.length;
                        this.offsets[last] += dir;
                    }
                    else {
                        if (dir &lt; 0)
                            this.offsets[last]--;
                        this.nodes.push(next);
                        this.offsets.push(dir &gt; 0 ? 1 : (next instanceof TextLeaf ? next.text.length : next.children.length) &lt;&lt; 1);
                    }
                }
            }
        }
        next(skip = 0) {
            if (skip &lt; 0) {
                this.nextInner(-skip, (-this.dir));
                skip = this.value.length;
            }
            return this.nextInner(skip, this.dir);
        }
    }
    class PartialTextCursor {
        constructor(text, start, end) {
            this.value = "";
            this.done = false;
            this.cursor = new RawTextCursor(text, start &gt; end ? -1 : 1);
            this.pos = start &gt; end ? text.length : 0;
            this.from = Math.min(start, end);
            this.to = Math.max(start, end);
        }
        nextInner(skip, dir) {
            if (dir &lt; 0 ? this.pos &lt;= this.from : this.pos &gt;= this.to) {
                this.value = "";
                this.done = true;
                return this;
            }
            skip += Math.max(0, dir &lt; 0 ? this.pos - this.to : this.from - this.pos);
            let limit = dir &lt; 0 ? this.pos - this.from : this.to - this.pos;
            if (skip &gt; limit)
                skip = limit;
            limit -= skip;
            let { value } = this.cursor.next(skip);
            this.pos += (value.length + skip) * dir;
            this.value = value.length &lt;= limit ? value : dir &lt; 0 ? value.slice(value.length - limit) : value.slice(0, limit);
            this.done = !this.value;
            return this;
        }
        next(skip = 0) {
            if (skip &lt; 0)
                skip = Math.max(skip, this.from - this.pos);
            else if (skip &gt; 0)
                skip = Math.min(skip, this.to - this.pos);
            return this.nextInner(skip, this.cursor.dir);
        }
        get lineBreak() { return this.cursor.lineBreak &amp;&amp; this.value != ""; }
    }
    class LineCursor {
        constructor(inner) {
            this.inner = inner;
            this.afterBreak = true;
            this.value = "";
            this.done = false;
        }
        next(skip = 0) {
            let { done, lineBreak, value } = this.inner.next(skip);
            if (done) {
                this.done = true;
                this.value = "";
            }
            else if (lineBreak) {
                if (this.afterBreak) {
                    this.value = "";
                }
                else {
                    this.afterBreak = true;
                    this.next();
                }
            }
            else {
                this.value = value;
                this.afterBreak = false;
            }
            return this;
        }
        get lineBreak() { return false; }
    }
    if (typeof Symbol != "undefined") {
        Text.prototype[Symbol.iterator] = function () { return this.iter(); };
        RawTextCursor.prototype[Symbol.iterator] = PartialTextCursor.prototype[Symbol.iterator] =
            LineCursor.prototype[Symbol.iterator] = function () { return this; };
    }
    /**
    This type describes a line in the document. It is created
    on-demand when lines are [queried](https://codemirror.net/6/docs/ref/#text.Text.lineAt).
    */
    class Line {
        /**
        @internal
        */
        constructor(
        /**
        The position of the start of the line.
        */
        from, 
        /**
        The position at the end of the line (_before_ the line break,
        or at the end of document for the last line).
        */
        to, 
        /**
        This line's line number (1-based).
        */
        number, 
        /**
        The line's content.
        */
        text) {
            this.from = from;
            this.to = to;
            this.number = number;
            this.text = text;
        }
        /**
        The length of the line (not including any line break after it).
        */
        get length() { return this.to - this.from; }
    }

    const DefaultSplit = /\r\n?|\n/;
    /**
    Distinguishes different ways in which positions can be mapped.
    */
    var MapMode = /*@__PURE__*/(function (MapMode) {
        /**
        Map a position to a valid new position, even when its context
        was deleted.
        */
        MapMode[MapMode["Simple"] = 0] = "Simple";
        /**
        Return null if deletion happens across the position.
        */
        MapMode[MapMode["TrackDel"] = 1] = "TrackDel";
        /**
        Return null if the character _before_ the position is deleted.
        */
        MapMode[MapMode["TrackBefore"] = 2] = "TrackBefore";
        /**
        Return null if the character _after_ the position is deleted.
        */
        MapMode[MapMode["TrackAfter"] = 3] = "TrackAfter";
    return MapMode})(MapMode || (MapMode = {}));
    /**
    A change description is a variant of [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet)
    that doesn't store the inserted text. As such, it can't be
    applied, but is cheaper to store and manipulate.
    */
    class Change
