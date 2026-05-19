const ReceiptItem = require("../models/receiptModel");
const accountModel = require("../models/accounts-model");
const logger = require("../utils/logger");
const { formatService } = require("../utils/serviceFormatter");

async function addReceipt(req, res) {
    try {
        const {
            patient_name,
            patient_phone,
            patient_address,
            patient_gender,
            patient_age,
            patient_next_visit,
            room_number,
            service,
            qty,
            amount,
            total,
            mode_of_payment,
            amount_paid,
            balance
        } = req.body;

        // Validate required fields
        if (!patient_name || !patient_name.trim()) {
            return res.status(400).json({ message: "Patient name is required" });
        }
        if (!patient_phone || !patient_phone.trim()) {
            return res.status(400).json({ message: "Patient phone is required" });
        }

        // Convert empty strings to null/undefined
        const finalGender = patient_gender && patient_gender.trim() ? patient_gender : null;
        const finalAge = patient_age ? parseInt(patient_age) : null;
        const finalAddress = patient_address && patient_address.trim() ? patient_address : null;
        const finalNextVisit = patient_next_visit && patient_next_visit.trim() ? patient_next_visit : null;
        const finalRoomNumber = room_number && room_number.trim() ? room_number : null;

        const finalAmountPaid = amount_paid || total || 0;
        const finalBalance = balance ?? ((total || 0) - finalAmountPaid);

        // Prepare options for patient ID handling
        const options = {};
        if (req.body.use_patient_id) {
            options.usePatientId = req.body.use_patient_id;
        }
        if (req.body.force_new_id === 'true' || req.body.force_new_id === true) {
            options.forceNewId = true;
        }

        const receipt = await ReceiptItem.createReceipt(
            patient_name.trim(),
            patient_phone.trim(),
            finalAddress,
            finalGender,
            finalAge,
            finalNextVisit,
            finalRoomNumber,
            service,
            qty || 1,
            amount || total || 0,
            total || 0,
            mode_of_payment,
            finalAmountPaid,
            finalBalance,
            options
        );

        if (!receipt) {
            logger.error("Failed to add receipt: Database operation returned null");
            return res.status(500).json({ message: "Error adding receipt" });
        }

        const data = await ReceiptItem.getReceipts();

        return res.status(201).render("receipts", {
            title: "Receipts",
            receipts: data,
            user: req.user
        });

    } catch (error) {
        logger.error(`Error in addReceipt: ${error.message}`, error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteReciept(req, res) {
    try {
        const receipt_id = req.params.receipt_id;
        const deleted = await ReceiptItem.deleteReceipt(receipt_id);
        if (deleted) {
            res.status(200).json({ message: "Receipt deleted successfully" });
        } else {
            logger.warn(`Receipt with ID ${receipt_id} not found`);
            res.status(404).json({ message: "Receipt not found" });
        }
    } catch (error) {
        logger.error(`Error in deleteReciept: ${error.message}`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Error deleting receipt" });
        }
    }
}

async function getAllReceipts(req, res, next) {
    try {
        const data = await ReceiptItem.getReceipts();
        data.forEach(receipt => {
            // Use formatService to safely handle any service format
            receipt.service = formatService(receipt.service);

            // Format phone numbers to replace '0' with '256'
            if (receipt.patient_phone.startsWith('0')) {
                receipt.patient_phone = '256' + receipt.patient_phone.slice(1);
            }
        });

        if (req.user.usertype === 'admin') {
            return res.render("adminReceipts", {
                title: "Admin Receipts",
                receipts: data,
                user: req.user
            });
        } else {
            return res.render("receipts", {
                title: "Receipts List",
                receipts: data,
                user: req.user
            });
        }
    } catch (error) {
        logger.error(`Error in getAllReceipts: ${error.message}`, error);
        next(error);
    }
}

async function receiptDetails(req, res, next) {
    try {
        const receipt_id = req.params.receipt_id;
        const data = await ReceiptItem.getReceiptDetails(receipt_id);
        if (!data) {
            logger.warn(`Receipt details not found for ID ${receipt_id}`);
            return res.status(404).json({ message: "Receipt not found" });
        }

        if (typeof data.service === "string") {
            data.service = formatService(data.service);
        }

        // Log current signed-in user for debugging
        console.log('Current user:', req.user);

        // Fetch full user record from DB using id from token, so we can show served-by name
        let servedBy = null;
        try {
            if (req.user && req.user.id) {
                const accountResp = await accountModel.getAccountById(req.user.id);
                // accountResp is the [rows, fields] result from mysql2; rows is at index 0
                const rows = Array.isArray(accountResp) ? accountResp[0] : accountResp;
                if (rows && rows.length > 0) {
                    const acct = rows[0];
                    servedBy = acct.name || acct.email || acct.username || null;
                }
            }
        } catch (err) {
            logger.error(`Error fetching user for servedBy: ${err.message}`, err);
        }

        return res.render("receiptDetails", {
            title: "Receipt Details",
            receipt: data,
            user: req.user,
            servedBy
        });
    } catch (error) {
        logger.error(`Error in receiptDetails: ${error.message}`, error);
        next(error);
    }
}

async function updateReceipt(req, res) {
    try {
        const receipt_id = req.params.receipt_id;
        const { patient_name, patient_phone, patient_address, patient_gender, patient_age, patient_next_visit, room_number, service, qty, amount, total, mode_of_payment, amount_paid, balance } = req.body;

        // Validate required fields
        if (!patient_name || !patient_name.trim()) {
            return res.status(400).json({ message: "Patient name is required" });
        }
        if (!patient_phone || !patient_phone.trim()) {
            return res.status(400).json({ message: "Patient phone is required" });
        }

        // Fetch the receipt details
        const receipt = await ReceiptItem.getReceiptDetails(receipt_id);
        if (!receipt) {
            logger.warn(`Receipt with ID ${receipt_id} not found`);
            return res.status(404).json({ message: "Receipt not found" });
        }

        // Convert empty strings to null/undefined
        const finalGender = patient_gender && patient_gender.trim() ? patient_gender : null;
        const finalAge = patient_age ? parseInt(patient_age) : null;
        const finalAddress = patient_address && patient_address.trim() ? patient_address : null;
        const finalNextVisit = patient_next_visit && patient_next_visit.trim() ? patient_next_visit : null;
        const finalRoomNumber = room_number && room_number.trim() ? room_number : null;

        // Update receipt information
        const updated = await ReceiptItem.updateReceipt(
            receipt_id,
            patient_name.trim(),
            patient_phone.trim(),
            finalAddress,
            finalGender,
            finalAge,
            finalNextVisit,
            finalRoomNumber,
            service,
            qty || 1,
            amount || total || 0,
            total || 0,
            mode_of_payment,
            amount_paid || total || 0,
            balance !== undefined ? balance : (total || 0) - (amount_paid || total || 0)
        );

        if (updated) {
            res.status(200).render("receiptEdit", {
                message: "Receipt updated successfully",
                receipt, // Pass the receipt object to the view
                user: req.user
            });
        } else {
            logger.warn(`Receipt with ID ${receipt_id} not updated`);
            res.status(404).json({ message: "Receipt not updated" });
        }
    } catch (error) {
        logger.error(`Error in updateReceipt: ${error.message}`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Error updating receipt" });
        }
    }
}

async function viewPatientRecords(req, res) {
    try {
        const patient_name = decodeURIComponent(req.params.patient_name).trim();
        
        // First check if there are multiple patients with this name
        const db = require("../config/db")();
        const connection = await db;
        const existingPatients = await ReceiptItem.getExistingPatientByName(connection, patient_name);
        await connection.end();

        if (!existingPatients || existingPatients.length === 0) {
            logger.warn(`No patients found with name ${patient_name}`);
            return res.status(404).render("error", {
                title: "Error",
                message: "Patient not found",
                user: req.user
            });
        }

        // If multiple patients with same name, show selection page
        if (existingPatients.length > 1) {
            return res.render("patientSelection", {
                title: "Select Patient",
                patients: existingPatients,
                searchName: patient_name,
                user: req.user
            });
        }

        // Single patient found, get their receipts
        const patient = existingPatients[0];
        const patientReceipts = await ReceiptItem.getReceiptsByPatient(patient.patient_phone);

        // Process receipts to format services
        patientReceipts.forEach(receipt => {
            receipt.service = formatService(receipt.service);
        });

        return res.render("patientRecords", {
            title: "Patient Records",
            patientDetails: patient,
            patientReceipts,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in viewPatientRecords: ${error.message}`, error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function searchOldPatients(req, res) {
    try {
        const patientName = req.query.name;
        
        if (!patientName || !patientName.trim()) {
            return res.status(400).json({ message: "Patient name is required" });
        }

        // Import the old DB model
        const oldDbModel = require("../models/oldDb-model");
        const oldPatients = await oldDbModel.searchByName(patientName);

        return res.json({
            success: true,
            data: oldPatients || [],
            count: oldPatients ? oldPatients.length : 0
        });
    } catch (error) {
        logger.error(`Error in searchOldPatients: ${error.message}`, error);
        return res.status(500).json({ 
            success: false, 
            message: "Error searching patient records",
            data: []
        });
    }
}

// Check if patient name already exists in database
async function checkDuplicateName(req, res) {
    try {
        const { patient_name } = req.body;

        if (!patient_name || !patient_name.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: "Patient name is required" 
            });
        }

        const db = require("../config/db")();
        const connection = await db;
        const existingPatients = await ReceiptItem.getExistingPatientByName(connection, patient_name.trim());
        await connection.end();

        if (existingPatients && existingPatients.length > 0) {
            return res.json({
                success: true,
                exists: true,
                message: `Found ${existingPatients.length} patient(s) with this name`,
                patients: existingPatients
            });
        }

        return res.json({
            success: true,
            exists: false,
            message: "No matching patient found",
            patients: []
        });
    } catch (error) {
        logger.error(`Error in checkDuplicateName: ${error.message}`, error);
        return res.status(500).json({ 
            success: false, 
            message: "Error checking for duplicate names",
            exists: null
        });
    }
}

// Validate and reformat patient ID
async function validatePatientId(req, res) {
    try {
        const { patient_id } = req.body;

        if (!patient_id || !patient_id.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: "Patient ID is required" 
            });
        }

        const db = require("../config/db")();
        const connection = await db;
        
        const { validateAndFormatPatientId } = ReceiptItem;
        const formattedId = await validateAndFormatPatientId(connection, patient_id.trim());
        
        await connection.end();

        // Check if this patient ID exists
        const db2 = require("../config/db")();
        const connection2 = await db2;
        const [existing] = await connection2.query(
            `SELECT DISTINCT patient_id, patient_name, patient_phone FROM receipts WHERE patient_id = ? LIMIT 1`,
            [formattedId]
        );
        await connection2.end();

        const isCorrectFormat = /^sds-\d{2}-\d{2}-\d{3}$/.test(formattedId);

        return res.json({
            success: true,
            message: isCorrectFormat ? "Patient ID is valid" : "Patient ID reformatted",
            formattedId: formattedId,
            isNewFormat: isCorrectFormat,
            exists: existing && existing.length > 0,
            patientData: existing && existing.length > 0 ? existing[0] : null
        });

    } catch (error) {
        logger.error(`Error in validatePatientId: ${error.message}`, error);
        return res.status(500).json({ 
            success: false, 
            message: "Error validating patient ID"
        });
    }
}

module.exports = { addReceipt, getAllReceipts, receiptDetails, deleteReciept, updateReceipt, viewPatientRecords, viewSpecificPatientRecords, searchOldPatients, checkDuplicateName, validatePatientId };

async function viewSpecificPatientRecords(req, res) {
    try {
        const patient_name = decodeURIComponent(req.params.patient_name);
        const patient_phone = decodeURIComponent(req.params.patient_phone);
        
        const patientDetails = await ReceiptItem.getPatientDetails(patient_phone);
        const patientReceipts = await ReceiptItem.getReceiptsByPatient(patient_phone);

        if (!patientDetails) {
            logger.warn(`Patient with phone ${patient_phone} not found`);
            return res.status(404).render("error", {
                title: "Error",
                message: "Patient not found",
                user: req.user
            });
        }

        // Verify the patient name matches
        if (patientDetails.patient_name !== patient_name) {
            logger.warn(`Patient name mismatch: expected ${patient_name}, got ${patientDetails.patient_name}`);
            return res.status(404).render("error", {
                title: "Error",
                message: "Patient not found",
                user: req.user
            });
        }

        // Process receipts to format services
        patientReceipts.forEach(receipt => {
            receipt.service = formatService(receipt.service);
        });

        return res.render("patientRecords", {
            title: "Patient Records",
            patientDetails,
            patientReceipts,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in viewSpecificPatientRecords: ${error.message}`, error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

