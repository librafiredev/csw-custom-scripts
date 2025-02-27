// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: crypto.randomBytes(16).toString('hex'),
    resave: false,
    saveUninitialized: true
}));

// Serve static files
app.use(express.static('public'));

// Authentication route
app.get('/auth', (req, res) => {
    const shop = req.query.shop || process.env.SHOP;
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    // Generate a random nonce
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store shop and nonce in session
    req.session.shop = shop;
    req.session.nonce = nonce;

    // Construct the authentication URL
    const redirectUri = `${process.env.HOST}/auth/callback`;
    const scopes = 'write_script_tags,read_orders';
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${nonce}`;

    res.redirect(authUrl);
});

// Auth callback
app.get('/auth/callback', async (req, res) => {
    const { shop, hmac, code, state } = req.query;
    const { nonce, shop: storedShop } = req.session;

    // Verify the shop
    if (shop !== storedShop) {
        return res.status(400).send('Shop does not match');
    }

    // Verify the nonce
    if (state !== nonce) {
        return res.status(400).send('Request origin cannot be verified');
    }

    // Calculate the HMAC
    const message = Object.entries(req.query)
        .filter(([key]) => key !== 'hmac')
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('&');

    const generatedHash = crypto
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
        .update(message)
        .digest('hex');

    // Verify the HMAC
    if (generatedHash !== hmac) {
        return res.status(400).send('HMAC validation failed');
    }

    try {
        // Exchange the code for an access token
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code
        });

        // Store the access token in the session
        req.session.accessToken = response.data.access_token;
        req.session.shop = shop;

        res.redirect('/success');
    } catch (error) {
        console.error('Error getting access token:', error);
        res.status(500).send('Error getting access token');
    }
});

// Success page
app.get('/success', (req, res) => {
    res.send(`
    <h1>Authentication successful!</h1>
    <p>You can now install the PO Number Prefill script.</p>
    <a href="/install-script">Click here to install the script</a>
  `);
});

// Install script tag
app.get('/install-script', async (req, res) => {
    const { accessToken, shop } = req.session;

    if (!accessToken || !shop) {
        return res.redirect(`/auth?shop=${process.env.SHOP}`);
    }

    try {
        // First, get existing script tags
        const getResponse = await axios.get(`https://${shop}/admin/api/2022-10/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken
            }
        });

        // Check for existing script tags with our URL
        const existingTags = getResponse.data.script_tags.filter(tag =>
            tag.src.includes('po-number-prefill.js')
        );

        // Delete existing tags
        for (const tag of existingTags) {
            await axios.delete(`https://${shop}/admin/api/2022-10/script_tags/${tag.id}.json`, {
                headers: {
                    'X-Shopify-Access-Token': accessToken
                }
            });
            console.log(`Deleted script tag ${tag.id}`);
        }

        // Create a new script tag
        const createResponse = await axios.post(`https://${shop}/admin/api/2022-10/script_tags.json`, {
            script_tag: {
                event: 'onload',
                src: `${process.env.HOST}/po-number-prefill.js`
            }
        }, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        console.log('Script tag created:', createResponse.data.script_tag);

        res.send(`
      <h1>Script Tag Installed Successfully</h1>
      <p>The PO Number Prefill script has been installed on your store.</p>
      <p>Script URL: ${process.env.HOST}/po-number-prefill.js</p>
      <p>It will be loaded on all pages, including checkout.</p>
      <a href="/view-scripts">View installed scripts</a>
    `);
    } catch (error) {
        console.error('Error installing script tag:', error);
        res.status(500).send(`Error installing script tag: ${error.message}`);
    }
});

// View script tags
app.get('/view-scripts', async (req, res) => {
    const { accessToken, shop } = req.session;

    if (!accessToken || !shop) {
        return res.redirect(`/auth?shop=${process.env.SHOP}`);
    }

    try {
        const response = await axios.get(`https://${shop}/admin/api/2022-10/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken
            }
        });

        let html = '<h1>Installed Script Tags</h1><ul>';

        response.data.script_tags.forEach(tag => {
            html += `<li>ID: ${tag.id} - Source: ${tag.src} - Event: ${tag.event}</li>`;
        });

        html += '</ul><a href="/">Home</a>';

        res.send(html);
    } catch (error) {
        console.error('Error fetching script tags:', error);
        res.status(500).send(`Error fetching script tags: ${error.message}`);
    }
});

// Home route
app.get('/', (req, res) => {
    res.send(`
    <h1>PO Number Prefill App</h1>
    <p>Use this app to automatically prefill PO Number fields in your Shopify checkout.</p>
    <a href="/auth?shop=${process.env.SHOP}">Authenticate with Shopify</a>
    <br><br>
    <a href="/install-script">Install Script Tag</a>
    <br><br>
    <a href="/view-scripts">View Installed Scripts</a>
  `);
});

// Start the server
app.listen(port, () => {
    console.log(`PO Number Prefill App listening at http://localhost:${port}`);
});