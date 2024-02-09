// Import the modules FS and HTTPS
const fs = require("fs");
const https = require("https");

// The bin ID and KEY
const id = "60e8c9f7e4b3f2a02c8c0a7a"; 
const secretKey = "$2b$10$z8Z1JZmQlO6YtXm8nHkLxO0K0Z5Wv9wZ7o6jyq7T0d0X4Zx0X1E4G";

// Cria uma função assíncrona que usa o método fetch() para obter o JSON do seu bin
async function getJSON(id, secretKey) {
  // Faz uma requisição HTTP GET para o seu bin
  let response = await fetch(`https://api.jsonbin.io/b/${id}`, {
    headers: {
      "secret-key": secretKey
    }
  });
  // Verifica se a resposta foi bem-sucedida
  if (response.ok) {
    // Converte a resposta em um objeto JavaScript
    let data = await response.json();
    // Retorna os dados
    return data;
  } else {
    // Lança um erro se a resposta falhou
    throw new Error(response.status);
  }
}

// Chama a função getJSON dentro de um bloco try...catch e passa o ID e a chave secreta como argumentos
try {
  // Chama a função getJSON com o ID e a chave secreta do seu bin
  let data = await getJSON(id, secretKey);
  // Faz algo com os dados
  console.log(data);
  // Converte os dados em uma string JSON
  let dataString = JSON.stringify(data);
  // Escreve a string JSON no arquivo data.json
  fs.writeFile("Strategy/data.json", dataString, (err) => {
    // Verifica se houve algum erro
    if (err) {
      // Lança o erro se ocorreu
      throw err;
    } else {
      // Exibe uma mensagem de sucesso se não ocorreu
      console.log("Arquivo data.json salvo com sucesso!");
    }
  });
} catch (error) {
  // Trata o erro se ocorrer
  console.error(error);
}

// Carrega o arquivo data.json em sua página index.html usando o método require() do Node.js
let data = require("Strategy/data.json");
// Faz algo com os dados
console.log(data);
