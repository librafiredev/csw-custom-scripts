// app.js
require('dotenv').config();
const express = require('express');
const { Shopify, ApiVersion } = require('@shopify/shopify-api');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Shopify API client
Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(','),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ''),
    API_VERSION: ApiVersion.October23,
    IS_EMBEDDED_APP: false
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for the script
app.use(express.static('public'));

// Authentication routes
app.get('/auth', async (req, res) => {
    if (!req.query.shop) {
        return res.status(400).send('Missing shop parameter. Please add ?shop=your-store.myshopify.com to the URL.');
    }

    const shop = req.query.shop;

    // Create a new OAuth process
    const authUrl = await Shopify.Auth.beginAuth(
        req, res, shop, '/auth/callback', false
    );

    res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
    try {
        const session = await Shopify.Auth.validateAuthCallback(
            req, res, req.query
        );

        // Store the session for later use
        console.log('Authentication successful for shop:', session.shop);

        res.redirect('/success');
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).send('Authentication failed: ' + error.message);
    }
});

app.get('/success', (req, res) => {
    res.send(`
    <h1>Authentication successful!</h1>
    <p>You can now install the PO Number Prefill script.</p>
    <a href="/install-script">Click here to install the script</a>
  `);
});

// Script tag installation endpoint
app.get('/install-script', async (req, res) => {
    try {
        // Get the current session
        const session = await Shopify.Utils.loadCurrentSession(req, res);

        if (!session) {
            return res.redirect(`/auth?shop=${process.env.SHOP}`);
        }

        // Check if script tag already exists
        const existingScriptTags = await Shopify.REST.ScriptTag.all({
            session,
        });

        // Delete existing script tags with the same source
        for (const tag of existingScriptTags.data) {
            if (tag.src.includes('po-number-prefill.js')) {
                await Shopify.REST.ScriptTag.delete({
                    session,
                    id: tag.id,
                });
                console.log(`Deleted existing script tag: ${tag.id}`);
            }
        }

        // Create a new script tag
        const scriptTag = new Shopify.REST.ScriptTag({ session });
        scriptTag.event = "onload";
        scriptTag.src = `${process.env.HOST}/po-number-prefill.js`;

        await scriptTag.save({
            update: true,
        });

        console.log(`Script tag installed successfully for shop: ${session.shop}`);

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

// Endpoint to view all script tags
app.get('/view-scripts', async (req, res) => {
    try {
        const session = await Shopify.Utils.loadCurrentSession(req, res);

        if (!session) {
            return res.redirect(`/auth?shop=${process.env.SHOP}`);
        }

        const scriptTags = await Shopify.REST.ScriptTag.all({
            session,
        });

        let response = '<h1>Installed Script Tags</h1><ul>';

        scriptTags.data.forEach(tag => {
            response += `<li>ID: ${tag.id} - Source: ${tag.src} - Event: ${tag.event}</li>`;
        });

        response += '</ul>';
        response += '<a href="/">Return to home</a>';

        res.send(response);
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
    console.log(`Set up to work with shop: ${process.env.SHOP}`);
});