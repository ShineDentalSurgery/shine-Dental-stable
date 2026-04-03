const SalesReportModel = require("../models/salesReportModel");
const ExpensesModel = require("../models/expensesModel");
const logger = require("../utils/logger");

// Helper function to format date in local timezone (YYYY-MM-DD)
function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get daily sales report
async function getDailyReport(req, res, next) {
    try {
        const today = getDateString(new Date());
        const selectedDate = req.query.date || today;

        logger.info(`Daily Report: Using date ${selectedDate}`);

        // Get sales data
        const dailySales = await SalesReportModel.getDailySalesSummary(selectedDate);
        
        // Get expenses data
        const dailyExpenses = await ExpensesModel.getExpensesByDate(selectedDate);
        const totalExpenses = await ExpensesModel.getTotalExpensesByDate(selectedDate);

        // Calculate net sales
        const beforeExpenses = dailySales.total_sales || 0;
        const afterExpenses = beforeExpenses - totalExpenses;

        res.render("salesReport", {
            title: "Daily Sales Report",
            reportType: "daily",
            selectedDate: selectedDate,
            today: today,
            sales: dailySales,
            totalExpenses: totalExpenses || 0,
            beforeExpenses: beforeExpenses,
            afterExpenses: afterExpenses,
            expenses: dailyExpenses,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in getDailyReport: ${error.message}`, error);
        next(error);
    }
}

// Get weekly sales report
async function getWeeklyReport(req, res, next) {
    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startDate = getDateString(startOfWeek);
        const endDate = getDateString(endOfWeek);

        // Get sales data
        const weeklySales = await SalesReportModel.getWeeklySalesSummary(startDate, endDate);
        const weeklyTotals = await SalesReportModel.getWeeklyTotals(startDate, endDate);

        // Get expenses data
        const weeklyExpenses = await ExpensesModel.getExpensesByDateRange(startDate, endDate);
        const totalWeeklyExpenses = weeklyExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        // Add daily expenses to each day in the breakdown
        const dailyBreakdownWithExpenses = weeklySales.map(day => {
            const dayExpenses = weeklyExpenses
                .filter(exp => exp.date === day.sale_date)
                .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
            return {
                ...day,
                daily_expenses: dayExpenses
            };
        });

        // Calculate net sales
        const beforeExpenses = weeklyTotals.total_sales || 0;
        const afterExpenses = beforeExpenses - totalWeeklyExpenses;

        res.render("salesReport", {
            title: "Weekly Sales Report",
            reportType: "weekly",
            startDate: startDate,
            endDate: endDate,
            sales: weeklyTotals,
            dailyBreakdown: dailyBreakdownWithExpenses,
            totalExpenses: totalWeeklyExpenses,
            beforeExpenses: beforeExpenses,
            afterExpenses: afterExpenses,
            expenses: weeklyExpenses,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in getWeeklyReport: ${error.message}`, error);
        next(error);
    }
}

// Get monthly sales report
async function getMonthlyReport(req, res, next) {
    try {
        const today = new Date();
        const selectedYear = parseInt(req.query.year) || today.getFullYear();
        const selectedMonth = parseInt(req.query.month) || (today.getMonth() + 1);

        // Get sales data
        const monthlySales = await SalesReportModel.getMonthlySalesSummary(selectedYear, selectedMonth);
        const monthlyTotals = await SalesReportModel.getMonthlyTotals(selectedYear, selectedMonth);

        // Get expenses data
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`;
        const monthlyExpenses = await ExpensesModel.getExpensesByDateRange(startDate, endDate);
        const totalMonthlyExpenses = monthlyExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        // Add daily expenses to each day in the breakdown
        const dailyBreakdownWithExpenses = monthlySales.map(day => {
            const dayExpenses = monthlyExpenses
                .filter(exp => exp.date === day.sale_date)
                .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
            return {
                ...day,
                daily_expenses: dayExpenses
            };
        });

        // Calculate net sales
        const beforeExpenses = monthlyTotals.total_sales || 0;
        const afterExpenses = beforeExpenses - totalMonthlyExpenses;

        // Generate month options
        const months = [
            { value: 1, name: 'January' },
            { value: 2, name: 'February' },
            { value: 3, name: 'March' },
            { value: 4, name: 'April' },
            { value: 5, name: 'May' },
            { value: 6, name: 'June' },
            { value: 7, name: 'July' },
            { value: 8, name: 'August' },
            { value: 9, name: 'September' },
            { value: 10, name: 'October' },
            { value: 11, name: 'November' },
            { value: 12, name: 'December' }
        ];

        res.render("salesReport", {
            title: "Monthly Sales Report",
            reportType: "monthly",
            selectedYear: selectedYear,
            selectedMonth: selectedMonth,
            months: months,
            sales: monthlyTotals,
            dailyBreakdown: dailyBreakdownWithExpenses,
            totalExpenses: totalMonthlyExpenses,
            beforeExpenses: beforeExpenses,
            afterExpenses: afterExpenses,
            expenses: monthlyExpenses,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in getMonthlyReport: ${error.message}`, error);
        next(error);
    }
}

// Get annual sales report
async function getAnnualReport(req, res, next) {
    try {
        const today = new Date();
        const selectedYear = parseInt(req.query.year) || today.getFullYear();

        // Get sales data
        const annualSales = await SalesReportModel.getAnnualSalesSummary(selectedYear);
        const annualTotals = await SalesReportModel.getAnnualTotals(selectedYear);

        // Get expenses data
        const annualExpenses = await ExpensesModel.getExpensesByDateRange(
            `${selectedYear}-01-01`,
            `${selectedYear}-12-31`
        );
        const totalAnnualExpenses = annualExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        // Add monthly expenses to each month in the breakdown
        const monthlyBreakdownWithExpenses = annualSales.map(month => {
            const monthNumber = String(month.month).padStart(2, '0');
            const monthExpenses = annualExpenses
                .filter(exp => exp.date.startsWith(`${selectedYear}-${monthNumber}`))
                .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
            return {
                ...month,
                monthly_expenses: monthExpenses
            };
        });

        // Calculate net sales
        const beforeExpenses = annualTotals.total_sales || 0;
        const afterExpenses = beforeExpenses - totalAnnualExpenses;

        res.render("salesReport", {
            title: "Annual Sales Report",
            reportType: "annual",
            selectedYear: selectedYear,
            sales: annualTotals,
            monthlyBreakdown: monthlyBreakdownWithExpenses,
            totalExpenses: totalAnnualExpenses,
            beforeExpenses: beforeExpenses,
            afterExpenses: afterExpenses,
            expenses: annualExpenses,
            user: req.user
        });
    } catch (error) {
        logger.error(`Error in getAnnualReport: ${error.message}`, error);
        next(error);
    }
}

module.exports = {
    getDailyReport,
    getWeeklyReport,
    getMonthlyReport,
    getAnnualReport
};
