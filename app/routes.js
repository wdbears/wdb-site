// const mongoose = require("mongoose");
const User = require("../app/models/user");
const Quote = require("../app/models/quote");
const async = require("async");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

module.exports = function(app, passport) {


  app.get("/", (req, res) => {
    res.render("index");
  });

  app.get("/profile",  (req, res) => {
    res.render("profile");
  });

  app.get("/forgot-password", (req, res) => {
    res.render("forgot-password", { user: req.user });
  });

  app.get("/reset", (req, res) =>{
    res.rednder("reset");
  })

  app.post("/forgot-password", (req, res, next) => {
    async.waterfall(
      [
        function(done) {
          crypto.randomBytes(20, function(err, buffer) {
            let token = buffer.toString("hex");
            done(err, token);
          });
        },
        function(token, done) {
          User.findOne({ "local.email": req.body.email }, function(err, user) {
            if (err) return err;
            if (!user) {
              return done(null, false, {
                message: "No account with that email address exists."
              });
            }

            user.local.resetPasswordToken = token;
            user.local.resetPasswordExpires = Date.now() + 3600000;

            user.save(function(err) {
              done(err, token, user);
            });
          });
        },
        function(token, user, done) {
          const smtpTransport = nodemailer.createTransport({
            service: "SendGrid",
            auth: {
              user: "luistics",
              pass: "test"
            }
          });
          const mailOptions = {
            to: user.local.email,
            from: "passwordreset@wdbears.com",
            subject: "Password Reset Email - DO NOT REPLY",
            text:
              "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
              "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
              "http://" +
              req.headers.host +
              "/reset/" +
              token +
              "\n\n" +
              "If you did not request this, please ignore this email and your password will remain unchanged.\n"
          };
          smtpTransport.sendMail(mailOptions, function(err) {
            req.flash(
              "flashMessage",
              "An email has been sent to your account's email address"
            );
            done(err);
          });
        }
      ],
      function(err) {
        if (err) return next(err);
        res.redirect("/forgot-password");
      }
    );
  });

  app.get("/reset:token", (req, res) => {
    User.findOne(
      {
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
      },
      function(err, user) {
        if (err) console.log(err);
        if (!user) {
          req.flash(
            "flashMessage",
            "Password reset token has expired, or is invalid."
          );
          return res.redirect("/forgot-password");
        }
        res.render("reset", {
          user: req.user
        });
      }
    );
  });

  app.post("/reset:token", (req, res) => {
    async.waterfall([
      function(done) {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
          },
          function(err, user) {
            if (err) console.log(err);

            if (!user) {
              req.flash(
                "flashMessage",
                "Password reset token has expired, or is invalid."
              );
              return res.redirect("back");
            }

            user.local.password = req.body.password;
            user.local.resetPasswordToken = undefined;
            user.local.resetPasswordExpires = undefined;

            user.save(function(err){
              req.logIn(user, function(err){
                done(err, user);
              });
            });
          }
        );
      },
      function(user, done){
        let smtpTransport = nodemailer.createTransport({
          service: "SendGrid",
          auth:{
            user: "luistics",
            pass: "test"
          }
        });
        let mailOptions = {
          to: user.local.email,
          from: "passwordreset@wdbears.com",
          subject: "Your password has been changed.",
          text: 'Hello,\n\n' +
          'The password for your account at wdbears.me through ' + user.email + ' has just been changed.\n'
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          req.flash(
            "flashMessage",
            "Your password has been changed."
          );
          done(err);
        });
      }
    ], function(err){
      res.redirect('/');
    });
  });

  app.get("/memes", isLoggedIn, (req, res) => {
    res.render("memes");
  });

  app.get("/quotes", isLoggedIn, (req, res) => {
    Quote.find({}, function(err, quotes) {
      if (err) {
        console.log(err);
      }
      res.render("quotes", { allQuotes: quotes });
    });
  });

  app.get("/down", isLoggedIn, (req, res) => {
    res.render("down");
  });

  // Talk with group about the login and register forms i.e. where they will be GET requesting to

  app.get("/login", (req, res) => {
    res.render("login");
  });


  app.get("/register", (req, res) => {
    res.render("register");
  });

  app.post(
    "/login",
    passport.authenticate("local-login", {
      failureRedirect: "/login",
      failureFlash: true
    }),
    function(req, res) {
      if (req.body.remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = false;
      }
      res.redirect("/");
    }
  );

  app.post(
    "/register",
    passport.authenticate("local-register", {
      successRedirect: "/",
      failureRedirect: "/register",
      failureFlash: true
    })
  );

  app.get("/logout", function(req, res) {
    req.logOut();
    res.redirect("/");
  });

  function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/login");
  }
};
