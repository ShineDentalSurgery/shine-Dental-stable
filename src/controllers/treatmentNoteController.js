const TreatmentNoteModel = require("../models/treatmentNoteModel");
const ReceiptModel = require("../models/receiptModel");
const logger = require("../utils/logger");

// Render treatment form
async function showTreatmentForm(req, res, next) {
    try {
        const { patient_id } = req.query;
        let patientData = null;

        // If patient_id provided, fetch patient data
        if (patient_id) {
            const db = require("../config/db")();
            const connection = await db;
            const [patients] = await connection.query(
                `SELECT DISTINCT patient_id, patient_name, patient_phone, patient_address, gender, age 
                 FROM receipts 
                 WHERE patient_id = ? 
                 LIMIT 1`,
                [patient_id]
            );
            await connection.end();
            
            if (patients && patients.length > 0) {
                patientData = patients[0];
            }
        }

        res.render("treatmentForm", {
            title: "Treatment Notes",
            patientData: patientData,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in showTreatmentForm: ${error.message}`, error);
        next(error);
    }
}

// Print treatment form
async function printTreatmentForm(req, res, next) {
    try {
        const { patient_name, patient_phone, patient_id, patient_address, gender, age, treatment_date } = req.query;

        if (!patient_name || !patient_phone) {
            return res.status(400).render("error", {
                message: "Patient name and phone are required",
                user: req.user
            });
        }

        let formattedPatientId = patient_id;

        // If no patient ID provided, try to find existing or determine what to generate
        if (!formattedPatientId) {
            const db = require("../config/db")();
            const connection = await db;
            
            // Check if patient exists by phone
            const [existing] = await connection.query(
                `SELECT DISTINCT patient_id FROM receipts WHERE patient_phone = ? LIMIT 1`,
                [patient_phone]
            );

            if (existing && existing.length > 0) {
                formattedPatientId = existing[0].patient_id;
            } else {
                // Generate new patient ID
                formattedPatientId = await ReceiptModel.generatePatientId(connection);
            }

            await connection.end();
        } else {
            // Validate and reformat the provided ID
            const db = require("../config/db")();
            const connection = await db;
            formattedPatientId = await ReceiptModel.validateAndFormatPatientId(connection, formattedPatientId);
            await connection.end();
        }

        // Get additional patient data if available
        const db = require("../config/db")();
        const connection = await db;
        const [patientData] = await connection.query(
            `SELECT patient_id, patient_name, patient_phone, patient_address, gender, age FROM receipts 
             WHERE (patient_phone = ? OR patient_name = ?) AND patient_id IS NOT NULL 
             LIMIT 1`,
            [patient_phone, patient_name]
        );
        await connection.end();

        const patientInfo = patientData && patientData.length > 0 ? patientData[0] : {
            patient_id: formattedPatientId,
            patient_name: patient_name,
            patient_phone: patient_phone,
            patient_address: patient_address || '',
            gender: gender || '',
            age: age || ''
        };

        // Format the treatment date
        let treatmentDateFormatted = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        let treatmentDateDb = new Date().toISOString().split('T')[0];

        if (treatment_date) {
            const date = new Date(treatment_date);
            treatmentDateFormatted = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            treatmentDateDb = treatment_date;
        }

        res.render("treatmentPrint", {
            title: "Treatment Form - Print",
            patientId: patientInfo.patient_id,
            patientName: patientInfo.patient_name,
            patientPhone: patientInfo.patient_phone,
            patientAddress: patientInfo.patient_address || '',
            gender: patientInfo.gender || '',
            age: patientInfo.age || '',
            treatmentDate: treatmentDateFormatted,
            treatmentDateDb: treatmentDateDb,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in printTreatmentForm: ${error.message}`, error);
        next(error);
    }
}

// Save treatment note
async function saveTreatmentNote(req, res) {
    try {
        const {
            patient_id,
            patient_name,
            patient_phone,
            patient_address,
            gender,
            age,
            treatment_date
        } = req.body;

        // Validate required fields
        if (!patient_name || !patient_name.trim()) {
            return res.status(400).json({ success: false, message: "Patient name is required" });
        }
        if (!patient_phone || !patient_phone.trim()) {
            return res.status(400).json({ success: false, message: "Patient phone is required" });
        }
        if (!treatment_date) {
            return res.status(400).json({ success: false, message: "Treatment date is required" });
        }

        let finalPatientId = patient_id;

        // If patient_id is not provided or is empty, generate one
        if (!finalPatientId || !finalPatientId.trim()) {
            const db = require("../config/db")();
            const connection = await db;
            
            // Check if patient exists by phone
            const [existing] = await connection.query(
                `SELECT DISTINCT patient_id FROM receipts WHERE patient_phone = ? LIMIT 1`,
                [patient_phone.trim()]
            );

            if (existing && existing.length > 0) {
                finalPatientId = existing[0].patient_id;
            } else {
                // Generate new patient ID
                finalPatientId = await ReceiptModel.generatePatientId(connection);
            }

            await connection.end();
        } else {
            // Validate and reformat the provided ID
            const db = require("../config/db")();
            const connection = await db;
            finalPatientId = await ReceiptModel.validateAndFormatPatientId(connection, finalPatientId.trim());
            await connection.end();
        }

        // Create or update treatment note in database
        const noteId = await TreatmentNoteModel.createTreatmentNote(
            finalPatientId,
            patient_name.trim(),
            patient_phone.trim(),
            patient_address || null,
            gender || null,
            age ? parseInt(age) : null,
            treatment_date,
            '' // Empty treatment notes since they'll be hand-written on the form
        );

        logger.info(`Treatment note saved for patient ${finalPatientId}`);
        
        return res.status(200).json({
            success: true,
            message: "Treatment note saved successfully",
            noteId: noteId,
            patientId: finalPatientId
        });

    } catch (error) {
        logger.error(`Error in saveTreatmentNote: ${error.message}`, error);
        return res.status(500).json({
            success: false,
            message: "Error saving treatment note: " + error.message
        });
    }
}

// View treatment note
async function viewTreatmentNote(req, res, next) {
    try {
        const { note_id } = req.params;
        const note = await TreatmentNoteModel.getTreatmentNote(note_id);

        if (!note) {
            logger.warn(`Treatment note not found: ${note_id}`);
            return res.status(404).render("error", {
                message: "Treatment note not found",
                user: req.user
            });
        }

        res.render("treatmentNoteDetails", {
            title: "Treatment Note Details",
            note: note,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in viewTreatmentNote: ${error.message}`, error);
        next(error);
    }
}

// Get treatment notes for a patient
async function getPatientTreatmentNotes(req, res, next) {
    try {
        const { patient_id } = req.params;
        const notes = await TreatmentNoteModel.getTreatmentNotesByPatient(patient_id);

        if (!notes || notes.length === 0) {
            return res.json({
                success: true,
                notes: [],
                message: "No treatment notes found"
            });
        }

        return res.json({
            success: true,
            notes: notes
        });
    } catch (error) {
        logger.error(`Error in getPatientTreatmentNotes: ${error.message}`, error);
        return res.status(500).json({
            success: false,
            message: "Error fetching treatment notes"
        });
    }
}

// List all treatment notes
async function listTreatmentNotes(req, res, next) {
    try {
        const notes = await TreatmentNoteModel.getAllTreatmentNotes();

        res.render("treatmentNotesList", {
            title: "Treatment Notes",
            notes: notes,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in listTreatmentNotes: ${error.message}`, error);
        next(error);
    }
}

// Delete treatment note
async function deleteTreatmentNote(req, res, next) {
    try {
        const { note_id } = req.params;
        const deleted = await TreatmentNoteModel.deleteTreatmentNote(note_id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Treatment note not found"
            });
        }

        logger.info(`Treatment note deleted: ${note_id}`);
        return res.json({
            success: true,
            message: "Treatment note deleted successfully"
        });
    } catch (error) {
        logger.error(`Error in deleteTreatmentNote: ${error.message}`, error);
        return res.status(500).json({
            success: false,
            message: "Error deleting treatment note"
        });
    }
}

module.exports = {
    showTreatmentForm,
    printTreatmentForm,
    saveTreatmentNote,
    viewTreatmentNote,
    getPatientTreatmentNotes,
    listTreatmentNotes,
    deleteTreatmentNote
};
