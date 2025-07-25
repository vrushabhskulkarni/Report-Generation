// index.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path'); // Make sure 'path' module is imported for path.resolve()

async function generatePdfFromHtml(htmlContent, outputPath) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true }); // headless: true for production, false for debugging UI
        const page = await browser.newPage();

        // **Increase timeout for page operations**
        page.setDefaultNavigationTimeout(90000); // For setContent, goto, etc.
        page.setDefaultTimeout(90000); // For general operations like pdf()

        // Set the HTML content of the page
        // Also explicitly set timeout here for clarity, though setDefaultNavigationTimeout should cover it
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0', // Wait for fonts/images to load (consider 'load' if still timing out)
            timeout: 90000 // Increased timeout to 90 seconds for content loading
        });

        // Generate PDF
        await page.pdf({
            path: outputPath,
            format: 'A4',
            landscape: true, // Set to landscape orientation
            printBackground: true, // Important for background colors/images from CSS
            margin: {
                top: '1in',
                right: '1in',
                bottom: '1in',
                left: '1in'
            },
            timeout: 90000 // Increased timeout to 90 seconds for PDF generation
        });

        console.log(`PDF created successfully at ${outputPath}`);

    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function createReportPdf(jsonDataPath, outputPdfPath) {
    try {
        const jsonData = JSON.parse(fs.readFileSync(jsonDataPath, 'utf8'));

        const report = jsonData.report || {};
        const detailedLogs = jsonData.detailedLogs || [];

        // Create dynamic filename based on report.created_at
        if (report.created_at && outputPdfPath === 'generated_report.pdf') {
            // Format the date for filename (remove invalid characters)
            const createdAt = new Date(report.created_at);
            const formattedDate = createdAt.toISOString().replace(/[:.]/g, '-').slice(0, 19); // Format: YYYY-MM-DDTHH-MM-SS
            outputPdfPath = `report_${formattedDate}.pdf`;
            console.log(`Dynamic filename created: ${outputPdfPath}`);
        }

        // HTML template
        // Note the @font-face rule points to the TTF file.
        // The default body font is English.
        // Only .message-content will use the Marathi font.
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Report</title>
            <style>
                /* Define the Marathi font */
                @font-face {
                    font-family: 'NotoSansDevanagari';
                    /* Use path.resolve() to ensure the font file is correctly located
                       even if the script is run from a different directory. */
                    src: url('file://${path.resolve('NotoSansDevanagari-Regular.ttf')}') format('truetype');
                }
                body {
                    font-family: 'Helvetica Neue', Arial, sans-serif; /* Default English font */
                    margin: 0;
                    padding: 0;
                    color: #333;
                }
                h1, h2 {
                    color: #333;
                    text-align: center;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                    font-size: 10pt;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                    color: #555;
                }
                .summary-table th {
                    background-color: #007BFF;
                    color: white;
                }
                .logs-table th {
                    background-color: #28a745;
                    color: white;
                }
                /* IMPORTANT: Only apply Marathi font to message-content */
                .message-content {
                    font-family: 'NotoSansDevanagari', sans-serif; /* Marathi font specifically for this class */
                    white-space: pre-wrap; /* Preserves whitespace and wraps */
                    word-wrap: break-word; /* Breaks long words */
                }
                .status-success { color: green; font-weight: bold; }
                .status-failed { color: red; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Overall Report Summary</h1>
            <table class="summary-table">
                <thead>
                    <tr><th>Metric</th><th>Value</th></tr>
                </thead>
                <tbody>
                    <tr><td>ID</td><td>${report.id || 'N/A'}</td></tr>
                    <tr><td>Created At</td><td>${report.created_at || 'N/A'}</td></tr>
                    <tr><td>Total Contacts</td><td>${report.total_contacts || 'N/A'}</td></tr>
                    <tr><td>Successful Messages</td><td>${report.successful_messages || 'N/A'}</td></tr>
                    <tr><td>Failed Messages</td><td>${report.failed_messages || 'N/A'}</td></tr>
                    <tr><td>Message Type</td><td>${report.message_type || 'N/A'}</td></tr>
                    <tr><td>Status</td><td>${report.status || 'N/A'}</td></tr>
                </tbody>
            </table>

            <h2>Detailed Message Logs</h2>
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Created At</th>
                        <th>Phone Number</th>
                        <th>Message Content</th>
                        <th>Status</th>
                        <th>Error Message</th>
                    </tr>
                </thead>
                <tbody>
        `;

        detailedLogs.forEach(log => {
            // Convert status to English text for display
            const statusText = log.status === 1 ? 'Success' : (log.status === 0 ? 'Failed' : (log.status || 'N/A'));
            const statusClass = log.status === 1 ? 'status-success' : (log.status === 0 ? 'status-failed' : '');
            const errorMessage = log.error_message === null ? '' : (log.error_message || '');

            // Escape HTML entities in message_content to prevent injection issues or broken HTML
            const messageContentHtml = log.message_content ? String(log.message_content).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : 'N/A';

            htmlContent += `
                    <tr>
                        <td>${log.created_at || 'N/A'}</td>
                        <td>${log.phone_number || 'N/A'}</td>
                        <td class="message-content">${messageContentHtml}</td>
                        <td class="${statusClass}">${statusText}</td>
                        <td>${errorMessage}</td>
                    </tr>
            `;
        });

        htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        await generatePdfFromHtml(htmlContent, outputPdfPath);

    } catch (error) {
        console.error('Error in createReportPdf:', error);
    }
}

// Ensure you have reports.json and NotoSansDevanagari-Regular.ttf in the same directory
// Download Noto Sans Devanagari from Google Fonts: https://fonts.google.com/specimen/Noto+Sans+Devanagari
// The filename will be automatically generated based on the report creation date
createReportPdf('reports.json', 'generated_report.pdf');