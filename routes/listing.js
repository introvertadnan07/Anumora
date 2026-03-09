const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware");
const listingController = require("../controllers/listings");

const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });

/* ================= INDEX + CREATE ================= */
router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

/* ================= NEW FORM ================= */
router.get("/new", isLoggedIn, listingController.renderNewForm);

/* ================= ⭐ IMPORTANT FIX ⭐ */
/* Dashboard BEFORE :id */
router.get("/dashboard", isLoggedIn, wrapAsync(listingController.dashboard));

/* ================= SHOW + UPDATE + DELETE ================= */
router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destoryListing)
  );

/* ================= EDIT FORM ================= */
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

module.exports = router;