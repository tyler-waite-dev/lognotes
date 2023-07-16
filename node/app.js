const dotenv = require('dotenv')
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const session = require('express-session')
const genSessionConnectFunc = require('connect-pg-simple');

const {Pool} = require('pg');

// Passport config
const initializePassport = require('./passport-init')

// Load env vars
dotenv.config()

//create pool of postgres connections
const pool = new Pool({
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
});

pool.on('error', (err, client) => {

    if (err) {

        console.log('Trouble connecting to the postgres database.');
        console.error(err);
  
        process.exit(1);
    }
});

//find user in postgres db by email
async function findUserByEmail(email){

    try {
        const resp = await pool.query( "SELECT * FROM user_data WHERE email = $1",[email]);
        
        if(resp.rows.length > 0){
            return resp.rows[0];
        } else{
            return false;
        }
    } catch (err) {
        console.error(err.message);
        return false;
    }
}

//initialize passport's local strategy
initializePassport(
  passport,
  findUserByEmail
)

//decode the url parameters
app.use(express.urlencoded({ extended: false }))

//connection string for connect-pg-simple
const postgresConnString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

//initializes connect-pg-simple with connection
const PostgresqlStore = genSessionConnectFunc(session);
const sessionStore = new PostgresqlStore({
  conString: postgresConnString,
});

//setups sessions for user logins
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, 
  store: sessionStore, 
  cookie: { maxAge: 6 * 24 * 60 * 60 * 1000 }
}))

//initializes passport and passport sessions
app.use(passport.initialize())
app.use(passport.session())

//API ROUTES
app.use(express.static('public'))


function loginUserRoute(req, res, next){

    //passport.authenticate returns a function that we can call with req and res
    const passportAuthFunc = passport.authenticate('local', {}, (err, user, info) => {

        //passport error, call next function with error
        if (err) { 
            return next(err);
            
        //no user returned, send back error message
        } if (!user) { 
            return res.json({success: false, message: info.message}); 

        //user returned, send back success message
        } else {

            console.log("User logged in: ", user);

            //log the user in
            req.logIn(user, function(err) {
                if (err) {
                    res.json({success: false, message: "Error logging in."});
                } else {     
                    res.json({success: true, message: "Successfully logged in."});
                }
            });
        }
    });

    //call the passportAuthFunc with req and res
    passportAuthFunc(req, res);
}


//if user is not authenticated, calls passport-init authenticateUser function, then returns back to this callback.
app.post('/api/login', checkNotAuthenticated, loginUserRoute);

//registers a new user in the postgres db
app.post('/api/register', checkNotAuthenticated, async (req, res, next) => {
    try {
    
        var user = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: req.body.password
        };

        //first name validation
        if(user.firstName.length < 1){
            res.json({success: false, message: "Please enter a first name."});

        //last name validation
        } else if(user.lastName.length < 1){
            res.json({success: false, message: "Please enter a last name."});

        //email validation
        } else if(user.email.length < 1){
            res.json({success: false, message: "Please enter an email."});
        } else if(user.email.indexOf('@') < 0){
            res.json({success: false, message: "Please enter a valid email."});
        } else if(user.email.indexOf(' ') >= 0){
            res.json({success: false, message: "Email cannot contain spaces."});
        } else if(user.email.indexOf('.') < 0){
            res.json({success: false, message: "Please enter a valid email."});

        //checks if the email is already in use
        } else if(await findUserByEmail(user.email) != false) {
            res.json({success: false, message: "Email already in use."});

        //password validation
        } else if(user.password.length < 1){
            res.json({success: false, message: "Please enter a password."});
        } else if(user.password.length < 8){
            res.json({success: false, message: "Password must be at least 8 characters."});
        } else if(user.password.indexOf(' ') >= 0){
            res.json({success: false, message: "Password cannot contain spaces."});
        } else if(user.password.search(/[0-9]/) < 0){
            res.json({success: false, message: "Password must contain at least one digit."});
        } else if(user.password.search(/[A-Z]/) < 0){
            res.json({success: false, message: "Password must contain at least one uppercase letter."});

        //all validation passed
        } else{

            //hashes the password
            const hashedPassword = await bcrypt.hash(req.body.password, 10)

            //inserts the user into the postgres db
            pool.query('INSERT INTO user_data (first_name, last_name, email, password, channels) VALUES ($1, $2, $3, $4, $5)', 
            [user.firstName, user.lastName, user.email, hashedPassword, []], 
            (err, resp) => {
                if(err){
                    res.json({success: false, message: "Server error when registering user."})
                } else{

                    //calls the loginUserRoute function to log the user in after they are successfully registered
                    next()
                }
            });
        }
    } catch (err) {
        console.error(err.message);

        res.json({success: false, message: "Server error when registering user."})
    }


}, loginUserRoute);

app.get('/api/tester', checkAuthenticated, (req, res) => {
    res.json({hello: 'world'})
});


//TODO change from get to post

//logs the user out
app.get('/api/logout', (req, res) => {

    //asks passport to remove the user's session
    req.logOut((err)=>{
  
      //if there is an error, send auth error #2
      if(err){
        res.json({auth_error: 2, message: 'error logging out'})
      }
    })
  
    //send success message
    res.json({success: true})
})

//checks if the user IS authenticated
function checkAuthenticated(req, res, next) {

    //asks passport if the user is authenticated
    if (req.isAuthenticated()) {

        //if the user is authenticated, continues to the next function
        return next()
    }

    //if the user is not authenticated, send auth error #1
    return res.json({auth_error: 1, message: 'user is not authenticated'})
}

//checks if the user IS NOT authenticated
function checkNotAuthenticated(req, res, next) {

    //asks passport if the user is authenticated
    if (req.isAuthenticated()) {

        //if the user is authenticated, send auth error #0
        return res.json({auth_error: 0, message: 'user is already authenticated'})
    }

    //if the user is not authenticated, continues to the next function
    next()
}

//server listens on specified port
app.listen(process.env.SERVER_PORT, (err) => {

    //if there is an error, logs it to the console
    if(err){
        console.error(err)
    } else {
        console.log(`Server listening on port ${process.env.SERVER_PORT}`)
    }
})