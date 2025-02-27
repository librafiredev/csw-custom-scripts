// app.js - simplified for custom app
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Home route
app.get('/', (req, res) => {
    res.send(`
    <h1>PO Number Prefill App</h1>
    <p>This app adds a script to prefill PO Number fields in checkout.</p>
    <a href="/install-script">Install Script Tag</a>
    <br><br>
    <a href="/view-scripts">View Installed Scripts</a>
  `);
});

// Install script tag (using admin API token directly)
app.get('/install-script', async (req, res) => {
    try {
        // Get existing script tags
        const getResponse = await axios.get(`https://${process.env.SHOP}/admin/api/2023-01/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': process.env.ADMIN_API_ACCESS_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        // Check for existing script tags with our URL
        const existingTags = getResponse.data.script_tags.filter(tag =>
            tag.src.includes('po-number-prefill.js')
        );

        // Delete existing tags
        for (const tag of existingTags) {
            await axios.delete(`https://${process.env.SHOP}/admin/api/2023-01/script_tags/${tag.id}.json`, {
                headers: {
                    'X-Shopify-Access-Token': process.env.ADMIN_API_ACCESS_TOKEN
                }
            });
            console.log(`Deleted script tag ${tag.id}`);
        }

        // Create a new script tag
        const createResponse = await axios.post(`https://${process.env.SHOP}/admin/api/2023-01/script_tags.json`, {
            script_tag: {
                event: 'onload',
                src: `${process.env.HOST}/po-number-prefill.js`
            }
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.ADMIN_API_ACCESS_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        console.log('Script tag created:', createResponse.data.script_tag);

        res.send(`
      <h1>Script Tag Installed Successfully</h1>
      <p>The PO Number Prefill script has been installed on your store.</p>
      <p>Script URL: ${process.env.HOST}/po-number-prefill.js</p>
      <a href="/view-scripts">View installed scripts</a>
    `);
    } catch (error) {
        console.error('Error installing script tag:', error.response?.data || error.message);
        res.status(500).send(`Error installing script tag: ${error.message}`);
    }
});

// View script tags
app.get('/view-scripts', async (req, res) => {
    try {
        const response = await axios.get(`https://${process.env.SHOP}/admin/api/2023-01/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': process.env.ADMIN_API_ACCESS_TOKEN
            }
        });

        let html = '<h1>Installed Script Tags</h1><ul>';

        response.data.script_tags.forEach(tag => {
            html += `<li>ID: ${tag.id} - Source: ${tag.src} - Event: ${tag.event}</li>`;
        });

        html += '</ul><a href="/">Home</a>';

        res.send(html);
    } catch (error) {
        console.error('Error fetching script tags:', error.response?.data || error.message);
        res.status(500).send(`Error fetching script tags: ${error.message}`);
    }
});

app.get('/manually-install', async (req, res) => {

    const response = await axios.post(
        `https://${process.env.SHOP}/admin/api/2023-10/script_tags.json`,
        {
            script_tag: {
                event: 'onload',
                src: `${process.env.HOST}/po-number-prefill.js`,
                display_scope: 'online_store' // Try setting this explicitly
            }
        },
        {
            headers: {
                'X-Shopify-Access-Token': process.env.ADMIN_API_ACCESS_TOKEN,
                'Content-Type': 'application/json'
            }
        }
    );
});


// Start the server
app.listen(port, () => {
    console.log(`PO Number Prefill App listening at http://localhost:${port}`);
});