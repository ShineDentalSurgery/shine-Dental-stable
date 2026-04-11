const express = require("express");
const router = express.Router();
const treatmentNoteController = require("../controllers/treatmentNoteController");
const authenticateToken = require("../middleware/authMiddleware");

// Show treatment notes form
router.get("/form", authenticateToken, treatmentNoteController.showTreatmentForm);

// Print treatment form
router.get("/print", authenticateToken, treatmentNoteController.printTreatmentForm);

// Save treatment note (legacy)
router.post("/save", authenticateToken, treatmentNoteController.saveTreatmentNote);

// View treatment note details
router.get("/:note_id", authenticateToken, treatmentNoteController.viewTreatmentNote);

// Get treatment notes for specific patient
router.get("/patient/:patient_id", authenticateToken, treatmentNoteController.getPatientTreatmentNotes);

// List all treatment notes
router.get("/", authenticateToken, treatmentNoteController.listTreatmentNotes);

// Delete treatment note
router.delete("/:note_id", authenticateToken, treatmentNoteController.deleteTreatmentNote);

module.exports = router;
