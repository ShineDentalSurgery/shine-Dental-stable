const express = require("express");
const router = express.Router();
const receiptController = require("../controllers/receiptController");
const authenticateToken = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/create", authenticateToken, receiptController.addReceipt);
router.post("/check-name", authenticateToken, receiptController.checkDuplicateName);
router.post("/validate-id", authenticateToken, receiptController.validatePatientId);
router.post("/edit/:receipt_id", authenticateToken, adminMiddleware, receiptController.updateReceipt)
router.get("/", authenticateToken, receiptController.getAllReceipts);
router.get("/search/old-patients/search", authenticateToken, receiptController.searchOldPatients);
router.get("/patient/:patient_name", authenticateToken, receiptController.viewPatientRecords);
router.get("/patient/:patient_name/phone/:patient_phone", authenticateToken, receiptController.viewSpecificPatientRecords);
router.delete("/delete/:receipt_id", authenticateToken, adminMiddleware, receiptController.deleteReciept);
router.get("/:receipt_id", authenticateToken, receiptController.receiptDetails);
router.get("/edit/:receipt_id", authenticateToken, adminMiddleware, async (req, res, next) => {
    try {
        const receipt_id = req.params.receipt_id;
        const receipt = await require("../models/receiptModel").getReceiptDetails(receipt_id);

        if (!receipt) {
            return res.status(404).send("Receipt not found");
        }

        res.render("receiptEdit", {
            title: "Edit Receipt",
            receipt,
            user: req.user
        });
    } catch (error) {
        console.error("Error fetching receipt for edit:", error);
        next(error);
    }
});

module.exports = router;
