const LocalStrategy = require("passport-local").Strategy;
const User = require("../app/models/user");
const randomstring = require('randomstring');
const async = require('async');

module.exports = async function(passport) {
  passport.serializeUser(async function(user, done) {
    await done(null, user.id);
  });

  passport.deserializeUser(async function(id, done) {
    await User.findById(id, function(err, user) {
      done(err, user);
    });
  });

  passport.use(
    "local-register",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        passReqToCallback: true
      },
      async function(req, username, password, done) {
        await process.nextTick(async function() {
          await User.findOne(
            {
              $or: [
                { "local.username": username.toLowerCase() },
                { "local.email": req.body.email }
              ]
            },
            async function(err, user) {
              if (err) return done(err);

              if (user) {
                if (user.local.username === username.toLowerCase()) {
                  return done(
                    null,
                    false,
                    req.flash("flashMessage", "That username is already taken.")
                  );
                }
                return done(
                  null,
                  false,
                  req.flash("flashMessage", "That email is already registered.")
                );
              } else {

                //generate random token
                const secretToken = randomstring.generate();
                const newUser = new User();

                newUser.local.secretToken = secretToken;
                newUser.local.confirmed = false;
                newUser.local.username = username.toLowerCase();
                newUser.local.password = newUser.generateHash(password);
                newUser.local.email = req.body.email;
                newUser.local.firstname = req.body.firstname;
                newUser.local.lastname = req.body.lastname;

                await newUser.save();
                
                await done(
                  null,
                  newUser,
                  req.flash(
                    "flashMessage",
                    "Check your email for a verification code before you may use the full site."
                  )
                );
              }
            }
          );
        });
      }
    )
  );

  passport.use(
    "local-login",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        passReqToCallback: true
      },

      async function(req, username, password, done) {
        await User.findOne({ "local.username": username.toLowerCase() }, async function(err, user) {
          if (err) return done(err);

          // for deploy, change this to one large message. This should not tell the user whether the username or password is the incorrect key.

          if (!user)
            return done(
              null,
              false,
              req.flash(
                "flashMessage",
                "Error. Wrong username or password."
              )
            );

          if (!user.validPassword(password))
            return done(
              null,
              false,
              req.flash(
                "flashMessage",
                "Error. Wrong username or password."
              )
            );

          await done(null, user);
        });
      }
    )
  );
};
