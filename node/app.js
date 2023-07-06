const express = require('express')
const app = express()
const port = 80

const { Client } = require("pg")

const dotenv = require("dotenv")
dotenv.config()

var pgConnected = false;


const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT
})

client.connect((err) => {
    if (err) {
        console.log("pg connection error", err.stack)
    } else {
        console.log("pg connected")
        pgConnected = true;
    }
})
    
app.get('/', (req, res) => {
    client.query('SELECT * FROM some_table', (err, result) => {
        if (err) {
            console.log(err)
        } else {
            console.log(result.rows)
            res.send(result.rows)
        }
    });
})

app.listen(port, () => {
    console.log(`Lognotes: listening on port ${port}`)
})
