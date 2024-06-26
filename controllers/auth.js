require("dotenv").config({ path: "../creds.env" });
const crypto = require("crypto");

const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

const { validationResult } = require("express-validator");

const User = require("../models/user");
const { use } = require("../routes/auth");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: SENDGRID_API_KEY, //add your sendGrid API_KEY
    },
  })
);

exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    pageTitle: "Login",
    path: "/login",
    errorMessage: req.flash("errorMessage"),
    oldInput: {
      email: "",
      password: "",
    },
    validationErrors: [],
  });
};

exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errorMessage: req.flash("errorMessage"),
    oldInput: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render("auth/login", {
      pageTitle: "Login",
      path: "/login",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
      },
      validationErrors: errors.array(),
    });
  }
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        return res.render("auth/login", {
          pageTitle: "Login",
          path: "/login",
          errorMessage: "Invalid email or password",
          oldInput: {
            email: email,
            password: password,
          },
          validationErrors: [],
        });
      }
      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.user = user;
            req.session.isLoggedIn = true;
            return req.session.save((err) => {
              if (err) {
                console.log("error saving session : " + err);
              }
              res.locals.userEmail = email;
              res.redirect("/");
            });
          }
          return res.render("auth/login", {
            pageTitle: "Login",
            path: "/login",
            errorMessage: "Invalid email or password",
            oldInput: {
              email: email,
              password: password,
            },
            validationErrors: [],
          });
        })
        .catch((err) => {
          console.log(
            "something went wrong while decrypting password : " + err
          );
          return res.redirect("/login");
        });
    })
    .catch((err) => {
      console.log("user not found: " + err);
      return res.redirect("/login");
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log("session being destroy!");
    res.redirect("/");
  });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const newUser = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });
      return newUser.save();
    })
    .then((result) => {
      res.redirect("/login");
      console.log(email);
      return transporter.sendMail({
        to: email,
        from: "", //from's email address
        subject: "Signup Successful!",
        html: "<h1>You successfully signed up to my website!</h1>",
      });
    })
    .catch((err) => {
      console.log(`error sending  mail: ${err}`);
    });
};

exports.getResetPassword = (req, res, next) => {
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: req.flash("errorMessage"),
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }
    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("errorMessage", "No account with that email found.");
          return res.redirect("/reset");
        }
        user.token = token;
        user.tokenExpiry = Date.now() + 3600000;
        return user.save();
      })
      .then((result) => {
        res.redirect("/");
        transporter.sendMail({
          to: req.body.email,
          from: "", //from's email address
          subject: "Password Reset",
          html: `<h5> Password Reset Through Link! </h5>
          <p>Click this link to reset your password : <a href="http://localhost:8000/reset/${token}"> Click Here To Reset Password </a> </p>`,
        });
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        console.log(`error logged : ${err}`);
        return next(error);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;

  User.findOne({ token: token, tokenExpiry: { $gt: Date.now() } })
    .then((user) => {
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "Reset Password",
        errorMessage: req.flash("errorMessage"),
        userId: user._id.toString(),
        resetPasswordToken: token,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      console.log(`error : ${err}`);
      console.log(`error in getNewPassword while finding user ${err}`);
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const password = req.body.password;
  const userId = req.body.userId;
  const resetPasswordToken = req.body.resetPasswordToken;
  let resetUser;

  User.findOne({
    token: resetPasswordToken,
    tokenExpiry: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      resetUser = user;
      return bcrypt.hash(password, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.token = undefined;
      resetUser.tokenExpiry = undefined;
      return resetUser.save();
    })
    .then((result) => {
      console.log(
        `Password reset successfully for user with id ${resetUser._id}`
      );
      res.redirect("/login");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      console.log(`error logged : ${err}`);
      console.log(`err in findOne postNewPassword ${err}`);
      return next(error);
    });
};
