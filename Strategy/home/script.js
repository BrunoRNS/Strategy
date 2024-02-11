// Import the modules FS and HTTPS
const fs = require("fs");
const https = require("https");

// The bin ID and API of JSONBinIO
const id = "65c68d64266cfc3fde88254e"; 
const api = "$2a$10$3CIY0DoGOnJ8LKdzhENZ4OnjB2v5Ww1IRA9ZQuDUE1d4O3oG5gbRK";

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
    throw new Error(response.status);
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
      throw err;
    } else {
      // Success message
      console.log("200! Success");
    }
  });
} catch (error) {
  // If an exception happen in proccess
  console.error(error);
}

// Get the json in home page
let data = require("Strategy/data/data.json");
