
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const FIREBASE_DB_URL = "https://orders-339da-default-rtdb.asia-southeast1.firebasedatabase.app";
const GITHUB_KEY = process.env.GITHUB_KEY || "";
// Optional GitHub repo details if you want backend to commit store templates, 
// but Firebase RTDB handles dynamic storage seamlessly. Let's make Firebase RTDB the core engine 
// and handle GitHub token verification or routing.

// API: Register Seller / Create Store
app.post('/api/register-seller', async (req, res) => {
    try {
        const { shopName, ownerName, password } = req.body;
        const formattedShopName = shopName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check if shop already exists in Firebase RTDB
        const checkRes = async (url) => {
            const r = await fetch(url);
            return await r.json();
        };

        const existingStores = await checkRes(`${FIREBASE_DB_URL}/stores/${formattedShopName}.json`);
        if (existingStores) {
            return res.status(400).json({ success: false, message: "Shop name already exists! Choose another one." });
        }

        // Save store data to Firebase RTDB
        const storeData = {
            ownerName,
            shopName: formattedShopName,
            password,
            bio: "Welcome to " + shopName + "! Quality products delivered directly.",
            products: {},
            createdAt: new Date().toISOString()
        };

        const saveRes = await fetch(`${FIREBASE_DB_URL}/stores/${formattedShopName}.json`, {
            method: 'PUT',
            body: JSON.stringify(storeData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (saveRes.ok) {
            // If GitHub token is present, we can also trigger a record or commit if needed
            res.json({ 
                success: true, 
                message: "Store created successfully!", 
                storeUrl: `/store/${formattedShopName}`,
                shopName: formattedShopName
            });
        } else {
            res.status(500).json({ success: false, message: "Failed to save to database." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
});

// API: Get Store Data
app.get('/api/store/:shopName', async (req, res) => {
    try {
        const shopName = req.params.shopName.toLowerCase();
        const r = await fetch(`${FIREBASE_DB_URL}/stores/${shopName}.json`);
        const data = await r.json();
        if (!data) {
            return res.status(404).json({ success: false, message: "Store not found." });
        }
        res.json({ success: true, store: data });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching store." });
    }
});

// API: Upload Product to Store
app.post('/api/upload-product', async (req, res) => {
    try {
        const { shopName, password, product } = req.body;
        const r = await fetch(`${FIREBASE_DB_URL}/stores/${shopName}.json`);
        const store = await r.json();

        if (!store || store.password !== password) {
            return res.status(401).json({ success: false, message: "Invalid shop credentials." });
        }

        const productId = 'prod_' + Date.now();
        product.id = productId;

        await fetch(`${FIREBASE_DB_URL}/stores/${shopName}/products/${productId}.json`, {
            method: 'PUT',
            body: JSON.stringify(product),
            headers: { 'Content-Type': 'application/json' }
        });

        res.json({ success: true, message: "Product uploaded successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error uploading product." });
    }
});

// API: Get All Products across all stores (for Buyer Marketplace search)
app.get('/api/marketplace', async (req, res) => {
    try {
        const r = await fetch(`${FIREBASE_DB_URL}/stores.json`);
        const stores = await r.json();
        let allProducts = [];

        if (stores) {
            Object.keys(stores).forEach(shopKey => {
                const store = stores[shopKey];
                if (store.products) {
                    Object.keys(store.products).forEach(prodKey => {
                        allProducts.push({
                            ...store.products[prodKey],
                            shopName: store.shopName,
                            ownerName: store.ownerName,
                            storeUrl: `/store/${store.shopName}`
                        });
                    });
                }
            });
        }
        res.json({ success: true, products: allProducts });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error loading marketplace." });
    }
});

// Dynamic Store page route support (e.g. /storename or /store/storename)
app.get('/store/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`DukaanGo running on port ${PORT}`);
});
