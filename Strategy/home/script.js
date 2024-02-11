// The bin ID and API of JSONBinIO
function data(form, id ="65c68d64266cfc3fde88254e", api = "$2a$10$3CIY0DoGOnJ8LKdzhENZ4OnjB2v5Ww1IRA9ZQuDUE1d4O3oG5gbRK") {
    // Import the modules FS and HTTPS
    const fs = require("fs");
    const https = require("https");
    // An async function to get the json
    async function getJSON(id, api) {
      // A https request with fetch in the method GET, to get the JSON
      let response = await fetch(`https://api.jsonbin.io/b/${id}`, {
      headers: {
         "secret-key": api
      }
      });
      // Verify if ok
      if (response.ok) {
         // Convert into json
         let data = await response.json();
         // Return data
         return data;
      } else {
         // Raise an error if failed
         form.insertAdjacentHTML("beforeend", "<p class='erro'>Error 103.</p>");
      }
   }

   // Call the GetJSON function recursiving
   try {
     let data = await getJSON(id, api);
     // Convert in a JSON string
     let dataString = JSON.stringify(data);
     // Change Data Content
     fs.writeFile("/Strategy/data.json", dataString, (err) => {
        // Verify if there is an error
        if (err) {
           // Throw the error             
           form.insertAdjacentHTML("beforeend", "<p class='erro'>Error 100." + err + "</p>");
        } else {
           // Success message
           console.log("200! Success");
        }
     });
   } catch (error) {
       // If an exception happen in proccess
       form.insertAdjacentHTML("beforeend","<p class='erro'>Error 106." + error + "</p>");
   }
