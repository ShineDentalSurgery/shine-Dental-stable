const express = require("express");
const bodyParser = require("body-parser");
const expressLayouts = require("express-ejs-layouts");
const static = require("./src/routes/static");
const cors = require("cors");
const path = require("path");
const { formatPatientId } = require("./src/utils/patientIdFormatter");
const { formatService, formatPhone } = require("./src/utils/serviceFormatter");
const authenticateToken = require('./src/middleware/authMiddleware');
const receiptRoutes = require("./src/routes/receiptRoutes");
const invoiceRoutes = require("./src/routes/invoiceRoutes");
const appointmentRoutes = require("./src/routes/appointmentRoutes");
const treatmentRoutes = require("./src/routes/treatmentRoutes");
const baseController = require("./src/controllers/baseController");
const dbold = require("./src/routes/databaseOld-route");
const flash = require("connect-flash");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const accountRoutes = require('./src/routes/account-route');
const baseRoutes = require('./src/routes/baseroute');
const expensesRoutes = require('./src/routes/expensesRoutes');
const salesReportRoutes = require('./src/routes/salesReportRoutes');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Set up cookie-parser middleware
app.use(cookieParser()); // Ensure cookie-parser is set up before routes

// Set up session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up flash middleware
app.use(flash());

// Make flash messages available in all views
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

// Middleware to attach user to res.locals
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.formatPatientId = formatPatientId;
    res.locals.formatService = formatService;
    res.locals.formatPhone = formatPhone;
    next();
});

/* ***********************
 * view engine and templates
 *************************/
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layouts/layout");

// Routes
app.use(static);

// Serve views folder
app.use("/", baseRoutes);

app.get("/receipt", require("./src/routes/baseroute"));

app.use("/receipt", require("./src/routes/receiptRoutes"));
app.use("/receipts", require("./src/routes/receiptRoutes"));
app.use("/receiptDetails", require("./src/routes/receiptRoutes"));
// app.use("/delete", require("./src/routes/receiptRoutes"));

// Invoice routes
app.use("/invoices", invoiceRoutes);

// Expenses routes
app.use("/expenses", expensesRoutes);

// Sales Report routes
app.use("/sales-report", salesReportRoutes);

// Appointments routes
app.use("/appointments", appointmentRoutes);

// Treatment Notes routes
app.use("/treatment", treatmentRoutes);

// login routes
app.use("/account", accountRoutes);

// Protected route 
app.get('/', authenticateToken, baseController.buildHome);

// old database page - support both route formats
app.use('/databaseOld', dbold);
app.use('/database-old', dbold);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
