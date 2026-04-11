const baseController = {}
const ReceiptModel = require("../models/receiptModel");
const InvoiceModel = require("../models/invoiceModel");
const SalesReportModel = require("../models/salesReportModel");
const ExpensesModel = require("../models/expensesModel");
const AppointmentModel = require("../models/appointmentModel");
const logger = require("../utils/logger");

// Helper function to get today's date in local timezone (not UTC)
function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

baseController.buildHome = async function (req, res, next) {
    try {
        // Fetch statistics
        const receipts = await ReceiptModel.getReceipts();
        const invoices = await InvoiceModel.getInvoices();

        // Get today's date in local timezone
        const today = getTodayDateString();
        logger.info(`Dashboard: Using today's date: ${today}`);

        // Get daily sales and expenses
        const dailySalesData = await SalesReportModel.getDailySalesSummary(today);
        const dailyExpensesData = await ExpensesModel.getTotalExpensesByDate(today);

        // Calculate paid and outstanding using local timezone
        const todayReceipts = receipts.filter(r => {
            const receiptDate = new Date(r.created_at);
            const receiptYear = receiptDate.getFullYear();
            const receiptMonth = String(receiptDate.getMonth() + 1).padStart(2, '0');
            const receiptDay = String(receiptDate.getDate()).padStart(2, '0');
            const formattedReceiptDate = `${receiptYear}-${receiptMonth}-${receiptDay}`;
            return formattedReceiptDate === today;
        });

        const paidSalesCount = todayReceipts.filter(r => parseFloat(r.balance) === 0).length;
        const outstandingAmount = todayReceipts.reduce((sum, r) => sum + parseFloat(r.balance || 0), 0);

        // If user is not an admin, show a simplified dashboard
        if (req.user && req.user.usertype && req.user.usertype !== 'admin') {
            const recentReceipts = receipts.slice(-5).reverse();
            const recentInvoices = invoices.slice(-5).reverse();
            
            // Get upcoming appointments for normal users
            let upcomingAppointments = [];
            try {
                upcomingAppointments = await AppointmentModel.getPatientsWithUpcomingVisits();
            } catch (error) {
                logger.warn(`Could not fetch upcoming appointments: ${error.message}`);
            }
            
            return res.render("simpleDashboard", {
                title: "Dashboard",
                user: req.user,
                recentReceipts,
                recentInvoices,
                receiptsCount: receipts.length,
                invoicesCount: invoices.length,
                dailySales: dailySalesData.total_sales || 0,
                dailyExpenses: dailyExpensesData || 0,
                paidSalesCount: paidSalesCount,
                outstandingAmount: outstandingAmount,
                upcomingAppointments
            });
        }

        // Calculate stats
        const totalReceipts = receipts.length;
        const totalInvoices = invoices.length;
        
        const totalReceiptAmount = receipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
        const totalInvoiceAmount = invoices.reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
        
        const totalReceiptBalance = receipts.reduce((sum, r) => sum + parseFloat(r.balance || 0), 0);
        
        const paidInvoices = invoices.filter(i => i.status === 'paid').length;
        const sentInvoices = invoices.filter(i => i.status === 'sent').length;
        const draftInvoices = invoices.filter(i => i.status === 'draft').length;

        // Get recent items (last 5)
        const recentReceipts = receipts.slice(-5).reverse();
        const recentInvoices = invoices.slice(-5).reverse();
        
        // Get upcoming appointments (7 days)
        let upcomingAppointments = [];
        try {
            upcomingAppointments = await AppointmentModel.getPatientsWithUpcomingVisits();
        } catch (error) {
            logger.warn(`Could not fetch upcoming appointments: ${error.message}`);
        }

        res.render("dashboard", {
            title: "Dashboard",
            user: req.user,
            stats: {
                totalReceipts,
                totalInvoices,
                totalReceiptAmount: totalReceiptAmount.toFixed(2),
                totalInvoiceAmount: totalInvoiceAmount.toFixed(2),
                totalReceiptBalance: totalReceiptBalance.toFixed(2),
                paidInvoices,
                sentInvoices,
                draftInvoices
            },
            dailySales: dailySalesData.total_sales || 0,
            dailyExpenses: dailyExpensesData || 0,
            paidSalesCount: paidSalesCount,
            outstandingAmount: outstandingAmount,
            recentReceipts,
            recentInvoices,
            upcomingAppointments
        });
    } catch (error) {
        logger.error(`Error in buildHome: ${error.message}`, error);
        next(error);
    }
}

baseController.buildReceipt = async function (req, res, next) {
    return res.render("receipt", {
        title: "Receipt Form",
        user: req.user
    });
}

module.exports = baseController;

// Render a blank page with logo (simple template)
baseController.buildBlank = async function (req, res, next) {
    try {
        return res.render('blank_template', {
            title: 'Blank',
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in buildBlank: ${error.message}`, error);
        next(error);
    }
}
baseController.buildTreatmentNote = async function (req, res, next) {
    try {
        return res.render('treatment_note', {
            title: 'Treatment Note',
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in buildBlank: ${error.message}`, error);
        next(error);
    }
}