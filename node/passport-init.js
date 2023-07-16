const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

//initializes passport's local strategy
module.exports = (passport, getUserByEmail) => {

  //determines if the entered password matches the hashed password for the associated user's email
  const authenticateUser = async (email, password, done) => { 

    //finds the user by email
    const user = await getUserByEmail(email)

    //if there is no user with that email, becomes a tattle tale to passport
    if (user == false) {
      return done(null, false, { message: 'No user with that email' })
    }

    //if there is a user with that email, compares the entered password with the hashed password
    try {

      //if the passwords match, returns the user
      if (await bcrypt.compare(password, user.password)) {

        delete user['password']

        return done(null, user)

      //if the passwords do not match, becomes a tattle tale to passport
      } else {
        return done(null, false, { message: 'Password incorrect' })
      }
    
    //if there is an error, tells passport
    } catch (e) {
      return done(e)
    }
  }

  //tells passport to use the local strategy and to use the email as the username field, and to use the authenticateUser function
  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))

  //tells passport to serialize the session to the user's id
  passport.serializeUser((user, done) => done(null, user.email))

  //tells passport to deserialize the session from the user's id to the user's data
  passport.deserializeUser((email, done) => {

    var user = getUserByEmail(email)

    return done(null, user)
  })
}