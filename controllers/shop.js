const Product = require("../models/product");
const Order = require("../models/order");

// const Cart = require("../models/cart");

exports.getProducts = (req, res, next) => {
  Product.find()
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;

  Product.findById(prodId)
    .then((theProduct) => {
      res.render("shop/product-detail", {
        pageTitle: theProduct.title,
        path: "/products",
        product: theProduct,
      });
    })
    .catch((err) => console.log(err));
};

exports.getIndex = (req, res, next) => {
  Product.find()
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const product = user.cart.items;
      res.render("shop/cart", {
        pageTitle: "Your Cart",
        path: "/cart",
        products: product,
        // totalPrice: totalCartPrice
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      res.redirect("/cart");
      console.log("ho gaya add" + result);
    });
};

exports.postCartItemDelete = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        pageTitle: "Your Orders",
        path: "/orders",
        orders: orders,
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      console.log(` order k products: ${products}`);
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      console.log("err aaya hai orders me:  " + err);
    });
  // .then((user) => {
  //   const products = user.cart.items.map((i) => {
  //     return { quantity: i.quantity, products: i.productId };
  //   });
  //   const order = new Order({
  //     user: {
  //       name: req.user.name,
  //       userId: req.user,
  //     },
  //     products: products,
  //   });
  //   return order.save();
  // })
  // .then((result) => {
  //   res.redirect("/orders");
  // })
  // .catch((err) => {
  //   console.log(err);
  // });
};

// exports.getCheckout = (req,res,next )=>{
//     res.render("shop/checkout",{
//         pageTitle: "CheckOut Here",
//         path: "/checkout"
//     });
// }
