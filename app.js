const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const util = require('util');
const { checkPassword } = require('./passwordValidator'); 
require('dotenv').config();
const { sendEmail } = require('./emailModule');



// Middleware setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'vinay123',
    database: 'farmer3'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

app.use((req, res, next) => {
    console.log('Session user:', req.session.user);
    next();
});

// Middleware to check if the user is a farmer
// function isFarmer(req, res, next) {
//     if (req.session.user && req.session.user.role === 'farmer') {
//         return next();
//     } else {
//         return res.status(403).send('Access Denied');
//     }
// };

// Ensure the 'uploads' directory exists
//const fs = require('fs');



function isFarmer(req, res, next) {
    if (req.session.user && req.session.user.role === 'farmer') {
        return next();
    }
    res.redirect('/');
}


// const createRoleMiddleware = (requiredRole) => {
//     return (req, res, next) => {
//         console.log('Session user:', req.session.user);
//         if (req.session.user && req.session.user.role === requiredRole) {
//             return next();
//         } else {
//             return res.status(403).send('Access Denied');
//         }
//     };
// };




// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});


// Initialize upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // Limit file size to 1MB
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).single('image');




function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}


// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


function sendConfirmationEmail(email, name) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Registration Successful',
        text: `Hi ${name},\n\nThank you for registering. Your account has been successfully created.\n\nRegards,\nFarmer Marketplace Team`
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.error(err);
        else console.log('Email sent: ' + info.response);
    });
}


// const emailVerificationToken = crypto.randomBytes(32).toString('hex');
// db.query('INSERT INTO users (email_verification_token) VALUES (?) WHERE email = ?', [emailVerificationToken, email], (err) => {
//     if (err) {
//         console.error('Error storing email verification token:', err);
//         return res.status(500).send('Internal Server Error');
//     }
    
//     // Send verification email with the token URL
//     const verificationUrl = `http://localhost:3000/security/verify-email/${emailVerificationToken}`;
//     // sendEmail(email, verificationUrl); // Implement your email sending logic
// });



// Routes
app.get('/', (req, res) => {
    res.render('home');
});

app.get('/login', (req, res) => {
    res.render('login', { message: null });
});

app.get('/dashboard', isLoggedIn, (req, res) => {
    const user = req.session.user; // Assuming user data is stored in the session
    res.render('dashboard', { user });
});


app.post('/login', (req, res) => {
    const { email, password, role } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (results.length === 0) {
            return res.render('login', { message: 'Invalid email or password' });
        }

        const user = results[0];

        if (user.role !== role) {
            return res.render('login', { message: 'Invalid role selection' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error during login:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (!isMatch) {
                return res.render('login', { message: 'Invalid email or password' });
            }

            req.session.user = user;
            res.redirect('/profile');
        });
    });
});


function generateOTP() {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // Generates a 6-character OTP
}



function sendOTPEmail(userEmail, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Your OTP for Two-Step Authentication',
        text: `Your OTP for login is: ${otp}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error sending email:', error);
        }
        console.log('Email sent:', info.response);
    });
}



// app.post('/login', (req, res) => {
//     const { email, password, role } = req.body;
//     db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
//         if (err) {
//             console.error('Error during login:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }

//         if (results.length === 0) {
//             return res.render('login', { message: 'Invalid email or password' });
//         }

//         const user = results[0];

//         if (user.role !== role) {
//             return res.render('login', { message: 'Invalid role selection' });
//         }

//         bcrypt.compare(password, user.password, (err, isMatch) => {
//             if (err) {
//                 console.error('Error during login:', err);
//                 res.status(500).send('Internal Server Error');
//                 return;
//             }

//             if (!isMatch) {
//                 return res.render('login', { message: 'Invalid email or password' });
//             }

//             // Generate OTP
//             const otp = generateOTP();
//             const otpExpiry = Date.now() + 15 * 60 * 1000; // OTP valid for 15 minutes

//             // Update user record with OTP and expiry
//             db.query('UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?', [otp, otpExpiry, email], (err) => {
//                 if (err) {
//                     console.error('Error setting OTP:', err);
//                     res.status(500).send('Internal Server Error');
//                     return;
//                 }

//                 // Send OTP to user's email
//                 sendOTPEmail(email, otp);

//                 // Store user info in session and redirect to OTP verification page
//                 req.session.tempUser = { email, role };
//                 res.render('verifyOtp', { message: 'OTP sent to your email. Please enter the OTP to complete login.' });
//             });
//         });
//     });
// });



app.get('/security/request-otp', (req, res) => {
    res.render('requestOtp');
});

// app.get('/security/verify-otp', (req, res) => {
//     res.render('verifyOtp');
// });


app.get('/security/verify-otp', (req, res) => {
    const email = req.query.email;
    res.render('verifyOtp', { email });
});



app.post('/send-otp', (req, res) => {
    const { email } = req.body;

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Set OTP expiry time (e.g., 15 minutes)
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Update user with OTP and expiry
    const query = 'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?';
    db.query(query, [otp, otpExpiry, email], (err, results) => {
        if (err) {
            console.error('Error updating user with OTP:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.affectedRows === 0) {
            return res.status(404).send('No user found with that email.');
        }

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Email Verification',
            text: `Your OTP is ${otp}. It is valid for 15 minutes.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send('Internal Server Error');
            }

            // Redirect to OTP verification form with the email as a query parameter
            res.redirect(`/security/verify-otp?email=${email}`);
        });
    });
});



// Handle OTP verification
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    const query = 'SELECT * FROM users WHERE email = ? AND otp = ?';
    db.query(query, [email, otp], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(400).send('Invalid OTP or email.');
        }

        const user = results[0];

        // Check if OTP is expired
        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).send('OTP has expired.');
        }

        // Mark email as verified and clear OTP
        const updateQuery = 'UPDATE users SET email_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE email = ?';
        db.query(updateQuery, [email], (err) => {
            if (err) {
                console.error('Error updating user:', err);
                return res.status(500).send('Internal Server Error');
            }

            res.redirect('/');
        });
    });
});


app.get('/signup', (req, res) => {
    res.render('signup', { message: null });
});

// app.post('/signup', (req, res) => {
//     const { name, email, password, phone, role, fruitId } = req.body;

//     if (role === 'farmer' && !fruitId) {
//         return res.render('signup', { message: 'Fruit ID is required for farmers' });
//     }

//     if (name && email && password && role) {
//         db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
//             if (err) throw err;

//             if (results.length > 0) {
//                 return res.render('signup', { message: 'Account with this email already exists' });
//             }

//             bcrypt.hash(password, 10, (err, hash) => {
//                 if (err) throw err;

//                 const newUser = {
//                     name,
//                     email,
//                     password: hash,
//                     phone,
//                     role,
//                     fruitId: role === 'farmer' ? fruitId : null
//                 };

//                 db.query('INSERT INTO users SET ?', newUser, (err, results) => {
//                     if (err) throw err;
//                     res.redirect('/login');
//                 });
//             });
//         });
//     } else {
//         res.render('signup', { message: 'Please fill in all fields' });
//     }
// });



app.post('/signup', (req, res) => {
    const { name, email, password, phone, role, fruitId } = req.body;

    if (role === 'farmer' && !fruitId) {
        return res.render('signup', { message: 'Fruit ID is required for farmers' });
    }

    if (!checkPassword(password)) {
        return res.render('signup', { message: 'Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.' });
    }

    if (name && email && password && role) {
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) throw err;

            if (results.length > 0) {
                return res.render('signup', { message: 'Account with this email already exists' });
            }

            bcrypt.hash(password, 10, (err, hash) => {
                if (err) throw err;

                const newUser = {
                    name,
                    email,
                    password: hash,
                    phone,
                    role,
                    fruitId: role === 'farmer' ? fruitId : null
                };

                db.query('INSERT INTO users SET ?', newUser, (err, results) => {
                    if (err) throw err;

                    sendConfirmationEmail(email, name);
                    res.redirect('/login');
                });
            });
        });
    } else {
        res.render('signup', { message: 'Please fill in all fields' });
    }
});



app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// app.get('/profile', isLoggedIn, (req, res) => {
//     const userId = req.session.user.id;
//     db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
//         if (err) throw err;
//         res.render('profile', { user: results[0] });
//     });
// });


app.get('/profile', isLoggedIn, (req, res) => {
    const userId = req.session.user.id;

    db.query('SELECT name, email, phone, fruitId, role FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching profile:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('User not found');
            return;
        }

        const user = results[0];
        res.render('profile', { user });
    });
});



// Route to get product count by category for a specific farmer
app.get('/product/report', isLoggedIn, isFarmer, (req, res) => {
    const sql = `
        SELECT category, COUNT(*) as count 
        FROM products 
        GROUP BY category
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('productReport', { data: results });
    });
});




// Initialize multer with the storage configuration

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// app.post('/profile', (req, res) => {
//     const { name, email, phone, fruitId } = req.body;
//     const userId = req.session.user.id;

//     let query, values;
//     if (req.session.user.role === 'farmer' && fruitId) {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ?, fruitId = ? WHERE id = ?';
//         values = [name, email, phone, fruitId, userId];
//     } else {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?';
//         values = [name, email, phone, userId];
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Error updating profile:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }
//         req.session.user = { ...req.session.user, name, email, phone, fruitId };
//         res.redirect('/profile');
//     });
// });


// app.post('/profile', isLoggedIn,(req, res) => {
//     const { name, email, phone, fruitId } = req.body;
//     const userId = req.session.user.id;

//     // Check if any required field is missing
//     if (!name || !email || !phone || (req.session.user.role === 'farmer' && !fruitId)) {
//         return res.status(400).send('All fields are required');
//     }

//     let query, values;
//     if (req.session.user.role === 'farmer') {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ?, fruitId = ? WHERE id = ?';
//         values = [name, email, phone, fruitId, userId];
//     } else {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?';
//         values = [name, email, phone, userId];
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Error updating profile:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }
//         req.session.user = { ...req.session.user, name, email, phone, fruitId };
//         res.redirect('/profile');
//     });
// });



// app.post('/profile', isLoggedIn,(req, res) => {
//     const { name, email, phone, fruitId } = req.body;
//     const userId = req.session.user.id;

//     let query, values;
//     if (req.session.user.role === 'farmer' && fruitId) {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ?, fruitId = ? WHERE id = ?';
//         values = [name, email, phone, fruitId, userId];
//     } else {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?';
//         values = [name, email, phone, userId];
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Error updating profile:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }
//         req.session.user = { ...req.session.user, name, email, phone, fruitId };
//         res.redirect('/profile');
//     });
// });


// app.post('/profile', isLoggedIn, (req, res) => {
//     const { name, email, phone, fruitId } = req.body;
//     const userId = req.session.user.id;

//     // Check if any required field is missing for farmers
//     if (
//         !name?.trim() || 
//         !email?.trim() || 
//         !phone?.trim() || 
//         (req.session.user.role === 'farmer' && (!fruitId || !fruitId.trim()))
//     ) {
//         return res.status(400).send('All fields are required');
//     }

//     let query, values;
//     if (req.session.user.role === 'farmer') {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ?, fruitId = ? WHERE id = ?';
//         values = [name, email, phone, fruitId, userId];
//     } else {
//         query = 'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?';
//         values = [name, email, phone, userId];
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Error updating profile:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }
//         req.session.user = { ...req.session.user, name, email, phone, fruitId };
//         res.redirect('/profile');
//     });
// });


app.get('/products', isLoggedIn, (req, res) => {
    const user = req.session.user;

    db.query('SELECT * FROM products WHERE user_id = ?', [user.id], (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('products', { user: user, products: results, searchResults: [] });
    });
});

app.get('/products/add', isLoggedIn, (req, res) => {
    res.render('addProduct'); // Ensure you have an `addProduct.ejs` file in your views
});

app.post('/products/add', upload, isLoggedIn, (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { name, description, price, category } = req.body;
    const user = req.session.user;
    const image = req.file ? '/uploads/' + req.file.filename : null;

    const query = 'INSERT INTO products (user_id, name, description, price, category, image) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [user.id, name, description, price, category, image];

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Error adding product:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/products');
    });
});


app.get('/products/edit/:id', isLoggedIn, (req, res) => {
    const productId = req.params.id;
    const user = req.session.user;

    db.query('SELECT * FROM products WHERE id = ? AND user_id = ?', [productId, user.id], (err, results) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(404).send('Product not found');
        }

        res.render('editProduct', { product: results[0] });
    });
});


app.post('/products/edit/:id', upload, isLoggedIn, (req, res) => {
    const productId = req.params.id;
    const { name, description, price, category } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.existingImage;

    const sql = 'UPDATE products SET name = ?, description = ?, price = ?, category = ?, image = ? WHERE id = ?';
    db.query(sql, [name, description, price, category, image, productId], (err, results) => {
        if (err) {
            console.error('Error updating product:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/products');
    });
});


// Search functionality
app.get('/products/search', isLoggedIn, (req, res) => {
    const { name, category, price_min, price_max } = req.query;
    const queryParams = [];
    let query = 'SELECT * FROM products WHERE 1=1';

    if (name) {
        query += ' AND name LIKE ?';
        queryParams.push(`%${name}%`);
    }
    if (category) {
        query += ' AND category = ?';
        queryParams.push(category);
    }
    if (price_min) {
        query += ' AND price >= ?';
        queryParams.push(price_min);
    }
    if (price_max) {
        query += ' AND price <= ?';
        queryParams.push(price_max);
    }

    db.query(query, queryParams, (err, searchResults) => {
        if (err) {
            console.error('Error searching products:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (searchResults.length === 0) {
            // If no search results are found, query for available products to show
            const fallbackQuery = 'SELECT * FROM products';
            db.query(fallbackQuery, (err, availableProducts) => {
                if (err) {
                    console.error('Error fetching available products:', err);
                    return res.status(500).send('Internal Server Error');
                }
                return res.render('products', {
                    user: req.session.user,
                    products: availableProducts, // Display all available products
                    searchResults: [],
                    message: 'Sorry, we don\'t have that product. Our available products are:'
                });
            });
        } else {
            // If search results are found, display them
            res.render('products', {
                user: req.session.user,
                products: [], // Clear or ignore this if you use `searchResults`
                searchResults: searchResults
            });
        }
    });
});


app.get('/products/delete/:id', (req, res) => {
    const { id } = req.params;

    // Delete related reviews
    db.query('DELETE FROM reviews WHERE order_id IN (SELECT id FROM orders WHERE product_id = ?)', [id], (err) => {
        if (err) {
            console.error('Error deleting related reviews:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Delete related orders
        db.query('DELETE FROM orders WHERE product_id = ?', [id], (err) => {
            if (err) {
                console.error('Error deleting related orders:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Delete the product
            db.query('DELETE FROM products WHERE id = ?', [id], (err) => {
                if (err) {
                    console.error('Error deleting product:', err);
                    return res.status(500).send('Internal Server Error');
                }

                res.redirect('/products'); // Redirect to the products page after deletion
            });
        });
    });
});


app.post('/products/search', (req, res) => {
    const { name } = req.body;
    const query = 'SELECT * FROM products WHERE name LIKE ?';
    db.query(query, ['%' + name + '%'], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            res.render('searchResults', { products: [], message: 'Sorry, we don\'t have that product.', user: req.session.user });
        } else {
            res.render('searchResults', { products: results, message: null, user: req.session.user });
        }
    });
});


app.get('/order-management', isLoggedIn, (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('orderManagement', { products: results, searchResults: [], message: null });
    });
});


app.post('/order-management/search', isLoggedIn, (req, res) => {
    const { productName } = req.body;

    db.query('SELECT * FROM products WHERE name LIKE ?', ['%' + productName + '%'], (err, results) => {
        if (err) {
            console.error('Error searching products:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.render('orderManagement', { products: [], searchResults: [], message: 'Sorry, we don\'t have that product' });
        }

        res.render('orderManagement', { products: [], searchResults: results, message: null });
    });
});

app.post('/orders/:id/status', isLoggedIn, (req, res) => {
    if (req.session.user.role !== 'farmer') {
        return res.status(403).send('Access denied');
    }

    const orderId = req.params.id;
    const { status } = req.body;

    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err, results) => {
        if (err) {
            console.error('Error updating order status:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/orders');
    });
});

// Cancel order before it is shipped
// app.post('/orders/:id/cancel', isLoggedIn, (req, res) => {
//     const orderId = req.params.id;
//     const userId = req.session.user.id;

//     db.query('SELECT status FROM orders WHERE id = ? AND user_id = ?', [orderId, userId], (err, results) => {
//         if (err) {
//             console.error('Error fetching order:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         if (results.length === 0 || results[0].status !== 'Pending') {
//             return res.status(400).send('Order cannot be canceled.');
//         }

//         db.query('DELETE FROM orders WHERE id = ? AND user_id = ?', [orderId, userId], (err) => {
//             if (err) {
//                 console.error('Error canceling order:', err);
//                 return res.status(500).send('Internal Server Error');
//             }
//             res.redirect('/orders');
//         });
//     });
// });


app.post('/orders/:id/cancel', isLoggedIn,isUser, (req, res) => {
    console.log('Cancel order route hit'); // Add this line to check if the route is hit
    const orderId = req.params.id;
    const userId = req.session.user.id;

    db.query('SELECT status FROM orders WHERE id = ? AND user_id = ?', [orderId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0 || results[0].status !== 'Pending') {
            return res.status(400).send('Order cannot be canceled.');
        }

        db.query('DELETE FROM orders WHERE id = ? AND user_id = ?', [orderId, userId], (err) => {
            if (err) {
                console.error('Error canceling order:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/orders');
        });
    });
});






// Cart management
app.post('/cart/add', isLoggedIn, (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.user.id;

    // Validate quantity
    if (quantity > 15) {
        return res.status(400).send('You cannot add more than 15 quantities.');
    }

    // Fetch product details
    db.query('SELECT price, quantity AS availableQuantity FROM products WHERE id = ?', [productId], (err, results) => {
        if (err) {
            console.error('Error fetching product details:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(404).send('Product not found');
        }

        const { price, availableQuantity } = results[0];

        if (quantity > availableQuantity) {
            return res.status(400).send(`You cannot add more than the available quantity (${availableQuantity}).`);
        }

        // Check if product is already in the cart
        db.query('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId], (err, results) => {
            if (err) {
                console.error('Error checking cart:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (results.length > 0) {
                // Update quantity and price if product is already in the cart
                db.query('UPDATE cart SET quantity = quantity + ?, price = ? WHERE user_id = ? AND product_id = ?', [quantity, price, userId, productId], (err) => {
                    if (err) {
                        console.error('Error updating cart:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    res.redirect('/cart');
                });
            } else {
                // Add new item to the cart with price
                db.query('INSERT INTO cart (user_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [userId, productId, quantity, price], (err) => {
                    if (err) {
                        console.error('Error adding to cart:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    res.redirect('/cart');
                });
            }
        });
    });
});


app.get('/cart', isLoggedIn, (req, res) => {
    db.query('SELECT cart.*, products.name, products.price, products.image FROM cart JOIN products ON cart.product_id = products.id WHERE cart.user_id = ?', [req.session.user.id], (err, results) => {
        if (err) {
            console.error('Error fetching cart items:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('cart', { cartItems: results });
    });
});

app.post('/cart/remove', isLoggedIn, (req, res) => {
    const { productId } = req.body;

    db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [req.session.user.id, productId], (err, results) => {
        if (err) {
            console.error('Error removing from cart:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/cart');
    });
});


app.post('/cart/delete/:id', isLoggedIn, async (req, res) => {
    const cartItemId = req.params.id;
    const userId = req.session.user.id;

    try {
        // Delete the item from the cart
        await query('DELETE FROM cart WHERE id = ? AND user_id = ?', [cartItemId, userId]);

        // Fetch the updated cart items
        const cartItems = await query('SELECT * FROM cart WHERE user_id = ?', [userId]);

        // Redirect back to the cart page with the updated items
        res.redirect('/cart');
    } catch (err) {
        console.error('Error deleting cart item:', err);
        res.status(500).send('Internal Server Error');
    }
});

//const isFarmer = createRoleMiddleware('farmer');
app.post('/orders/update/:id', isLoggedIn, isFarmer, async (req, res) => {
    const orderId = req.params.id;
    const newStatus = req.body.status.charAt(0).toUpperCase() + req.body.status.slice(1).toLowerCase(); // Normalize status

    const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Canceled'];

    if (!validStatuses.includes(newStatus)) {
        console.error('Invalid order status:', newStatus);
        return res.status(400).send('Invalid order status');
    }

    try {
        // Fetch the user's email for notification
        const [order] = await query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).send('Order not found');
        }
        const [user] = await query('SELECT email FROM users WHERE id = ?', [order.user_id]);
        if (!user || !user.email) {
            console.error('User email not found or invalid');
            return res.status(404).send('User email not found');
        }

        // Update the order status
        await query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);

        // Define email options
        let subject, text;
        switch (newStatus) {
            case 'Pending':
                // No action needed for 'Pending'
                break;

            case 'Shipped':
                subject = 'Order Shipped';
                text = `Your order with ID ${orderId} has been shipped.`;
                break;

            case 'Delivered':
                // Delete the order and associated items
                //await query('DELETE FROM orders WHERE id = ?', [orderId]);
                //await query('DELETE FROM order_items WHERE order_id = ?', [orderId]);

                subject = 'Order Delivered';
                text = `Your order with ID ${orderId} has been delivered.`;
                break;

            case 'Canceled':
                // Delete the order and associated items
                //await query('DELETE FROM orders WHERE id = ?', [orderId]);
                //await query('DELETE FROM order_items WHERE order_id = ?', [orderId]);

                subject = 'Order Canceled';
                text = `Your order with ID ${orderId} has been canceled.`;
                break;
        }

        // Check if email options are valid
        if (subject && text) {
            if (!user.email) {
                console.error('No recipient email address found');
                return res.status(500).send('Recipient email address is missing');
            }
            
            console.log('Sending email with options:', { to: user.email, subject, text });
            await sendEmail(user.email, subject, text);
        }

        res.redirect('/farmer/orders');
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/farmer/orders', isLoggedIn, isFarmer, async (req, res) => {
    try {
        const farmerId = req.session.user.id; // Get farmer ID from session
        console.log('Fetching orders for farmer ID:', farmerId);

        const orders = await query('SELECT * FROM orders ');//WHERE farmer_id = ?', [farmerId]);

        if (orders.length === 0) {
            console.log('No orders found for farmer ID:', farmerId);
            return res.render('farmerOrders', { orders: [], message: 'No orders found' });
        }

        res.render('farmerOrders', { orders }); // Render with orders
    } catch (err) {
        console.error('Error fetching farmer orders:', err);
        res.status(500).send('Internal Server Error');
    }
});



// app.get('/farmer/orders', isLoggedIn, isFarmer, async (req, res) => {
//     try {
//         // Fetch all orders from the database
//         const orders = await query('SELECT * FROM orders');

//         // Define message as an empty string if it's not set
//         const message = req.query.status === 'updated' ? 'Order status updated successfully!' : '';

//         // Render the orders page with fetched orders and message
//         res.render('farmerOrders', { orders, message });
//     } catch (err) {
//         console.error('Error fetching farmer orders:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });


// Route to handle the main communication page
app.get('/communication', isLoggedIn, async (req, res) => {
    if (req.session.user.role === 'farmer') {
        // Redirect farmers to the manage demands page
        res.redirect('/communication/manage');
    } else {
        // Redirect users to the demand product page
        res.redirect('/communication/demand');
    }
});



// Route to display the product demand form
// Route to display the product demand form
app.get('/communication/demand', isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const productDemands = await query('SELECT * FROM product_demands WHERE user_id = ?', [userId]);
        const message = req.session.message;
        delete req.session.message; // Clear the message after it's been used

        res.render('demandProduct', { 
            title: 'Demand a Product',
            productDemands,
            message 
        });
    } catch (err) {
        console.error('Error fetching product demands:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle the form submission
app.post('/communication/demand', isLoggedIn, async (req, res) => {
    try {
        const { productName, quantity } = req.body;
        const userId = req.session.user.id;

        await query('INSERT INTO product_demands (user_id, product_name, quantity) VALUES (?, ?, ?)', [userId, productName, quantity]);

        req.session.message = 'Product demand submitted successfully.';
        res.redirect('/communication/demand');
    } catch (err) {
        console.error('Error demanding product:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Route to display the list of product demands
app.get('/communication/manage', isLoggedIn, isFarmer, async (req, res) => {
    try {
        const productDemands = await query('SELECT * FROM product_demands');
        const message = req.session.message;
        delete req.session.message; // Clear the message after it's been used

        res.render('manageDemands', { 
            title: 'Manage Product Demands', 
            productDemands,
            message 
        });
    } catch (err) {
        console.error('Error fetching product demands:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Route to update a product demand
app.post('/communication/manage/:id/update', isLoggedIn, isFarmer, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await query('UPDATE product_demands SET status = ? WHERE id = ?', [status, id]);

        let message;
        if (status === 'approved') {
            message = 'Product demand has been approved.';
        } else if (status === 'rejected') {
            message = 'Product demand has been rejected.';
        } else if (status === 'pending') {
            message = 'Product demand is pending.';
        }

        req.session.message = message;
        res.redirect('/communication/manage');
    } catch (err) {
        console.error('Error updating product demand:', err);
        res.status(500).send('Internal Server Error');
    }
});


function isUser(req, res, next) {
    if (req.session.user && req.session.user.role === 'user') {
        return next();
    }
    res.redirect('/');
}




// Route to display products for the user to review
app.get('/reviews', isLoggedIn, isUser, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const orders = await query(`
            SELECT o.id as order_id, p.id as product_id, p.name as product_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.user_id = ? AND o.status = 'delivered'
            AND o.id NOT IN (SELECT order_id FROM reviews WHERE user_id = ?)
        `, [userId, userId]);

        res.render('reviewOrders', { title: 'Review Products', orders });
    } catch (err) {
        console.error('Error fetching orders for review:', err);
        res.status(500).send('Internal Server Error');
    }
});


// app.get('/userReviews', isLoggedIn, isUser, (req, res) => {
//     const userId = req.session.user.id;
//     const query = 'SELECT reviews.*, products.name AS product_name FROM reviews JOIN products ON reviews.product_id = products.id WHERE reviews.user_id = ?';

//     db.query(query, [userId], (err, orders) => {
//         if (err) {
//             console.error('Error fetching reviews:', err);
//             return res.status(500).send('Internal Server Error');
//         }
//         res.render('userReviews', { reviews: orders });
//     });
// });


// app.post('/reviews', isLoggedIn, isUser, (req, res) => {
//     const userId = req.session.user.id;
//     const query = 'SELECT reviews.*, products.name AS product_name FROM reviews JOIN products ON reviews.product_id = products.id WHERE reviews.user_id = ?';

//     db.query(query, [userId], (err, orders) => {
//         if (err) {
//             console.error('Error fetching reviews:', err);
//             return res.status(500).send('Internal Server Error');
//         }
//         res.render('userReviews', { reviews: orders });
//     });
// });


// Assuming this is part of your app.js where you handle the review route

// app.get('/reviews', isLoggedIn,isUser, (req, res) => {
//     const userId = req.session.user.id;
//     const query = 'SELECT reviews.*, products.name FROM reviews JOIN products ON reviews.product_id = products.id WHERE products.user_id = ?';

//     db.query(query, [userId], (err, results) => {
//         if (err) {
//             console.error('Error fetching reviews:', err);
//             return res.status(500).send('Internal Server Error');
//         }
//         res.render('userReviews', { reviews: results });
//     });
// });




// Route to handle review submission
app.post('/reviews', isLoggedIn, isUser, async (req, res) => {
    try {
        const { order_id, product_id, rating, review_text } = req.body;
        const userId = req.session.user.id;

        await query('INSERT INTO reviews (user_id, product_id, order_id, rating, review) VALUES (?, ?, ?, ?, ?)', [userId, product_id, order_id, rating, review_text]);

        res.redirect('/review-thank-you');
    } catch (err) {
        console.error('Error submitting review:', err);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/review-thank-you', isLoggedIn, isUser, (req, res) => {
    res.render('reviewThankYou', { title: 'Thank You' });
});



// //Route to display reviews for the farmer
// app.get('/farmer/reviews', isLoggedIn, isFarmer, async (req, res) => {
//     try {
//         const reviews = await query(`
//             select * from reviews;
//         `);

//         res.render('farmerReviews', { title: 'Product Reviews', reviews });
//     } catch (err) {
//         console.error('Error fetching reviews:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });


// Route to display reviews for the farmer
app.get('/farmer/reviews', isLoggedIn, isFarmer, async (req, res) => {
    const farmerId = req.session.user.id;
    const query = 'SELECT reviews.*, users.name AS user_name, products.name AS product_name FROM reviews JOIN products ON reviews.product_id = products.id JOIN users ON reviews.user_id = users.id WHERE products.user_id = ?';

    db.query(query, [farmerId], (err, results) => {
        if (err) {
            console.error('Error fetching reviews:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('farmerReviews', { reviews: results });
    });
});


// app.get('/farmers/reviews', isLoggedIn, isFarmer, async (req, res) => {
//     try {
//         const farmerId = req.session.user.id;
//         const reviews = await query(`
//             SELECT r.id as review_id, r.rating, r.review, r.response, p.name as product_name
//             FROM reviews r
//             JOIN products p ON r.product_id = p.id
//             WHERE p.farmer_id = ?
//         `, [farmerId]);

//         res.render('farmerReviews', { title: 'Product Reviews', reviews });
//     } catch (err) {
//         console.error('Error fetching reviews for farmer:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });








// Function to generate response based on rating
// function generateResponse(rating) {
//     switch(rating) {
//         case 5:
//             return 'Thank you for the excellent rating! We are thrilled you loved the product.';
//         case 4:
//             return 'Thank you for the great rating! We appreciate your feedback.';
//         case 3:
//             return 'Thank you for the rating. We will work on improving the product.';
//         case 2:
//             return 'Sorry to hear that you are not fully satisfied. We will strive to do better.';
//         case 1:
//             return 'We apologize for the bad experience. We will address the issues immediately.';
//         default:
//             return 'Thank you for your feedback!';
//     }
// }



// Route to respond to a review
// app.post('/farmer/reviews/respond', isLoggedIn, isFarmer, async (req, res) => {
//     try {
//         const { review_id, response_message } = req.body;

//         // Generate automatic response based on rating
//         const review = await query('SELECT rating FROM reviews WHERE id = ?', [review_id]);
//         const autoResponse = generateResponse(review[0].rating);

//         const finalResponse = `${response_message} (Automated Response: ${autoResponse})`;

//         await query('UPDATE reviews SET response = ? WHERE id = ?', [finalResponse, review_id]);

//         res.redirect('/farmer/reviews'); // Ensure it redirects to the correct route
//     } catch (err) {
//         console.error('Error responding to review:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });





// app.post('/farmer/update-status', isLoggedIn, isFarmer, async (req, res) => {
//     try {
//         const { orderId, newStatus } = req.body; // Extract orderId and newStatus from the form

//         // Update the order status in the database
//         await query('UPDATE orders SET status = ? WHERE id = ? AND farmer_id = ?', [newStatus, orderId, req.session.user.id]);

//         // Redirect back to the orders page
//         res.redirect('/farmer/orders');
//     } catch (err) {
//         console.error('Error updating order status:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });






// app.post('/add-to-cart', isLoggedIn, (req, res) => {
//     const { productId, quantity } = req.body;
//     const userId = req.session.user.id;

//     // Validate quantity
//     if (quantity > 15) {
//         return res.send("You cannot add more than 15 units to the cart.");
//     }

//     // Fetch the price of the product from the products table
//     db.query('SELECT price FROM products WHERE id = ?', [productId], (err, results) => {
//         if (err) {
//             console.error('Error fetching product price:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         if (results.length === 0) {
//             return res.status(404).send('Product not found');
//         }

//         const price = results[0].price;

//         // Check if product is already in the cart
//         db.query('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId], (err, results) => {
//             if (err) {
//                 console.error('Error checking cart:', err);
//                 return res.status(500).send('Internal Server Error');
//             }

//             if (results.length > 0) {
//                 // Update quantity and price if product is already in the cart
//                 db.query('UPDATE cart SET quantity = quantity + ?, price = ? WHERE user_id = ? AND product_id = ?', [quantity, price, userId, productId], (err) => {
//                     if (err) {
//                         console.error('Error updating cart:', err);
//                         return res.status(500).send('Internal Server Error');
//                     }
//                     res.redirect('/cart');
//                 });
//             } else {
//                 // Add new item to the cart with price
//                 db.query('INSERT INTO cart (user_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [userId, productId, quantity, price], (err) => {
//                     if (err) {
//                         console.error('Error adding to cart:', err);
//                         return res.status(500).send('Internal Server Error');
//                     }
//                     res.redirect('/cart');
//                 });
//             }
//         });
//     });
// });



// Route to manage orders
app.get('/order-management', (req, res) => {
    if (!req.session.loggedIn) {
        return res.redirect('/login');
    }

    const userId = req.session.userId;
    const query = 'SELECT * FROM products WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) throw err;

        // Fetch user details
        const userQuery = 'SELECT * FROM users WHERE id = ?';
        db.query(userQuery, [userId], (err, userResult) => {
            if (err) throw err;

            res.render('orderManagement', { products: results, user: userResult[0], message: null });
        });
    });
});


// Route to view order history
app.get('/order/history', isLoggedIn, (req, res) => {
    db.query('SELECT * FROM orders JOIN products ON orders.product_id = products.id WHERE orders.user_id = ?', [req.session.user.id], (err, results) => {
        if (err) {
            console.error('Error fetching order history:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('orderHistory', { orders: results });
    });
});


const query = util.promisify(db.query).bind(db);
app.post('/order/place', isLoggedIn, (req, res) => {
    const userId = req.session.user.id;
    const paymentMethod = req.body.paymentMethod || 'Not Specified';
    const currentDate = new Date();
    const estimatedDeliveryDate = new Date(currentDate.setDate(currentDate.getDate() + 5)).toISOString().split('T')[0];

    console.log('Placing order for user:', userId);
    console.log('Payment method:', paymentMethod);

    db.query(`
        SELECT cart.id, cart.user_id, cart.product_id, cart.quantity, cart.price
        FROM cart
        WHERE cart.user_id = ?
    `, [userId], (err, cartItems) => {
        if (err) {
            console.error('Error fetching cart items:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (cartItems.length === 0) {
            return res.status(400).send('Your cart is empty.');
        }

        console.log('Cart items:', cartItems);

        const orderPromises = cartItems.map(item => {
            if (!item.price) {
                console.error('Error: Price is undefined for item:', item);
                return Promise.reject(new Error('Price is undefined'));
            }

            const totalPrice = item.quantity * item.price;
            console.log(`Calculating total price for product_id ${item.product_id}: ${item.quantity} * ${item.price} = ${totalPrice}`);

            return new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO orders (user_id, product_id, quantity, total_price, payment_method, status, estimated_delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [userId, item.product_id, item.quantity, totalPrice, paymentMethod, 'Pending', estimatedDeliveryDate],
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        });

        Promise.all(orderPromises)
            .then(() => {
                db.query('DELETE FROM cart WHERE user_id = ?', [userId], (err) => {
                    if (err) {
                        console.error('Error clearing cart:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    const emailSubject = 'Order Confirmation';
                    const emailText = `Your order has been placed and the estimated delivery date is ${estimatedDeliveryDate}.`;
                    sendEmail(req.session.user.email, emailSubject, emailText)
                        .then(() => {
                            res.render('orderConfirmation', { estimatedDeliveryDate });
                        })
                        .catch(emailErr => {
                            console.error('Error sending confirmation email:', emailErr);
                            res.status(500).send('Internal Server Error');
                        });
                });
            })
            .catch(err => {
                console.error('Error placing order:', err);
                res.status(500).send('Internal Server Error');
            });
    });
});


// Admin route to update available quantities
app.post('/products/:id/quantity', isLoggedIn, (req, res) => {
    const productId = req.params.id;
    const { quantity } = req.body;

    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }

    db.query('UPDATE products SET quantity = ? WHERE id = ?', [quantity, productId], (err, results) => {
        if (err) {
            console.error('Error updating product quantity:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/products');
    });
});


// Order management for farmers
app.get('/orders', isLoggedIn, (req, res) => {
    if (req.session.user.role === 'farmer') {
        db.query('SELECT orders.*, products.name AS product_name FROM orders JOIN products ON orders.product_id = products.id WHERE products.user_id = ?', [req.session.user.id], (err, results) => {
            if (err) {
                console.error('Error fetching orders:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('farmerOrders', { orders: results });
        });
    } else {
        db.query('SELECT * FROM orders WHERE user_id = ?', [req.session.user.id], (err, results) => {
            if (err) {
                console.error('Error fetching orders:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('userOrders', { orders: results });
        });
    }
});


app.post('/orders/update/:id', isLoggedIn, isFarmer, async (req, res) => {
    try {
        const orderId = req.params.id; // Get the order ID from the URL parameter
        const newStatus = req.body.status; // Get the new status from the form
        const farmerId = req.session.user.id; // Get the farmer ID from the session

        // Check if the order exists and belongs to the farmer
        const order = await query('SELECT * FROM orders WHERE id = ? AND farmer_id = ?', [orderId, farmerId]);
        if (order.length === 0) {
            console.log(`Order ID ${orderId} not found for farmer ID ${farmerId}`);
            return res.status(404).send('Order not found');
        }

        // Update the order status in the database
        await query('UPDATE orders SET status = ? WHERE id = ? AND farmer_id = ?', [newStatus, orderId, farmerId]);

        // Handle deletion if status is 'Delivered' or 'Canceled'
        if (newStatus === 'delivered' || newStatus === 'canceled') {
            await query('DELETE FROM orders WHERE id = ? AND farmer_id = ?', [orderId, farmerId]);
            // Optionally delete the order from the user's order list
            await query('DELETE FROM user_orders WHERE order_id = ?', [orderId]);
        }

        // Redirect back to the orders page
        res.redirect('/farmer/orders');
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).send('Internal Server Error');
    }
});





// // Render password reset request page
// app.get('/security/reset-password', (req, res) => {
//     res.render('resetPasswordRequest');
// });

// // Handle password reset request
// app.post('/security/reset-password', (req, res) => {
//     const { email } = req.body;
//     const token = crypto.randomBytes(20).toString('hex');
//     const expiresAt = new Date(Date.now() + 3600000); // 1 hour

//     const query = 'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)';
//     db.query(query, [email, token, expiresAt], (err, result) => {
//         if (err) {
//             console.error('Error inserting reset token:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         const resetUrl = `http://${req.headers.host}/security/reset-password/${token}`;

//         transporter.sendMail({
//             from: process.env.EMAIL,
//             to: email,
//             subject: 'Password Reset Request',
//             text: `Please click the following link to reset your password: ${resetUrl}`
//         }, (err, info) => {
//             if (err) {
//                 console.error('Error sending email:', err);
//                 return res.status(500).send('Error sending email.');
//             }

//             res.send('Password reset link sent to your email.');
//         });
//     });
// });

// // Password reset page
// app.get('/security/reset-password/:token', (req, res) => {
//     const { token } = req.params;

//     const query = 'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()';
//     db.query(query, [token], (err, results) => {
//         if (err) {
//             console.error('Error fetching reset token:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         if (results.length === 0) {
//             return res.send('Password reset token is invalid or has expired.');
//         }

//         res.render('resetPassword', { token: token });
//     });
// });

// // Handle password reset form submission
// app.post('/security/reset-password/:token', (req, res) => {
//     const { token } = req.params;
//     const { password } = req.body;

//     const query = 'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()';
//     db.query(query, [token], (err, results) => {
//         if (err) {
//             console.error('Error fetching reset token:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         if (results.length === 0) {
//             return res.send('Password reset token is invalid or has expired.');
//         }

//         const email = results[0].email;

//         bcrypt.hash(password, 10, (err, hash) => {
//             if (err) {
//                 console.error('Error hashing password:', err);
//                 return res.status(500).send('Internal Server Error');
//             }

//             db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email], (err) => {
//                 if (err) {
//                     console.error('Error updating password:', err);
//                     return res.status(500).send('Internal Server Error');
//                 }

//                 db.query('DELETE FROM password_resets WHERE email = ?', [email], (err) => {
//                     if (err) {
//                         console.error('Error deleting reset token:', err);
//                     }

//                     res.send('Password has been reset. You can now log in with your new password.');
//                 });
//             });
//         });
//     });
// });

// // Email verification route
// app.get('/security/verify-email/:token', (req, res) => {
//     const { token } = req.params;

//     const query = 'SELECT * FROM users WHERE email_verification_token = ?';
//     db.query(query, [token], (err, results) => {
//         if (err) {
//             console.error('Error fetching verification token:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         if (results.length === 0) {
//             return res.send('Email verification token is invalid.');
//         }

//         const user = results[0];
//         db.query('UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = ?', [user.id], (err) => {
//             if (err) {
//                 console.error('Error updating user:', err);
//                 return res.status(500).send('Internal Server Error');
//             }

//             res.send('Email has been verified. You can now log in.');
//         });
//     });
// });

app.get('/security', (req, res) => {
    res.render('security');
});

// Password reset request page
app.get('/security/reset-password', (req, res) => {
    res.render('resetPasswordRequest');
});

// Handle password reset request and render reset form
app.post('/security/reset-password', (req, res) => {
    const { email } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.send('No user found with that email.');
        }

        res.render('resetPassword', { email: email });
    });
});

// Handle password reset form submission
// app.post('/security/reset-password/:email', (req, res) => {
//     const { email } = req.params;
//     const { password } = req.body;

//     bcrypt.hash(password, 10, (err, hash) => {
//         if (err) {
//             console.error('Error hashing password:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email], (err) => {
//             if (err) {
//                 console.error('Error updating password:', err);
//                 return res.status(500).send('Internal Server Error');
//             }

//             res.send('Password has been reset. You can now log in with your new password.');
//             res.render('')
//         });
//     });
// });



app.post('/security/reset-password/:email', (req, res) => {
    const { email } = req.params;
    const { password } = req.body;

    if (!checkPassword(password)) {
        return res.status(400).send('Password does not meet the required criteria.');
    }

    db.query('SELECT password FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found.');
        }

        const currentPasswordHash = results[0].password;

        bcrypt.compare(password, currentPasswordHash, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (isMatch) {
                return res.status(400).send('New password cannot be the same as the old password.');
            }

            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    return res.status(500).send('Internal Server Error');
                }

                db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email], (err) => {
                    if (err) {
                        console.error('Error updating password:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    // Redirect to home page after password reset
                    res.redirect('/');
                });
            });
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
