import {ProductModel} from '../models/product.model.js';

// upload products
export const addProducts = async (req, res) => {
    try {
        // Sample products data matching the schema
        //const sampleProducts = [
            // {
            //     name: "Davido Signature Mug",
            //     description: "Official Davido Signature Mug ",
                
            //     price: 39.99,
            //     discountedPrice: 34.99,
            //     images: [
            //         { url: "img/store/home/mug.png", altText: "Davido Mug Front View" },
            //     ],
            //     categories: ["home"],
            //     type: "standard",
            //     variants: [
            //          { name: "Color", options: ["Black", "White", "Red"] }
            //      ],
            //     inventory: {
            //          stock: 75,
            //          sku: "DMUC001",
            //          barcode: "445678901234"
            //    },
            //     rating: {
            //         average: 4.5,
            //         count: 24
            //     },
            //     isFeatured: true,
            //     isNew: false,
            //     isLimitedEdition: false,
            //     tags: ["mug", "cotton", "official"],
            //     shippingInfo: {
            //         weight: 200,
            //         dimensions: {
            //             length: 30,
            //             width: 20,
            //             height: 2
            //         }
            //     },
            //     artistCollection: "davido"
            // },
            // {
            //     name: "30BG Exclusive Hoodie",
            //     description: "Limited edition hoodie from Davido's 30 Billion Gang collection",
            //     price: 79.99,
            //     discountedPrice: 69.99,
            //     images: [
            //         { url: "https://example.com/images/hoodie1.jpg", altText: "30BG Hoodie Front" }
            //     ],
            //     categories: ["apparel", "limited-edition"],
            //     type: "limited-edition",
            //     variants: [
            //         { name: "Size", options: ["M", "L", "XL"] }
            //     ],
            //     inventory: {
            //         stock: 50,
            //         sku: "30BG-HD01",
            //         barcode: "234567890123"
            //     },
            //     rating: {
            //         average: 4.8,
            //         count: 15
            //     },
            //     isFeatured: true,
            //     isNew: true,
            //     isLimitedEdition: true,
            //     tags: ["hoodie", "limited", "30bg"],
            //     shippingInfo: {
            //         weight: 500,
            //         dimensions: {
            //             length: 40,
            //             width: 30,
            //             height: 5
            //         }
            //     },
            //     artistCollection: "30bg"
            // },
            // {
            //     name: "Davido Logo Cap",
            //     description: "Official Davido logo snapback cap",
            //     price: 29.99,
            //     images: [
            //         { url: "https://example.com/images/cap1.jpg", altText: "Davido Cap Front" }
            //     ],
            //     categories: ["accessories"],
            //     type: "standard",
            //     variants: [
            //         { name: "Color", options: ["Black", "White", "Red"] }
            //     ],
            //     inventory: {
            //         stock: 75,
            //         sku: "DCAP001",
            //         barcode: "345678901234"
            //     },
            //     rating: {
            //         average: 4.2,
            //         count: 18
            //     },
            //     isFeatured: false,
            //     isNew: true,
            //     tags: ["cap", "snapback"],
            //     shippingInfo: {
            //         weight: 150,
            //         dimensions: {
            //             length: 25,
            //             width: 25,
            //             height: 10
            //         }
            //     }
            // },
            // {
            //     name: "A Better Time Album Vinyl",
            //     description: "Limited edition vinyl record of Davido's A Better Time album",
            //     price: 59.99,
            //     discountedPrice: 49.99,
            //     images: [
            //         { url: "https://example.com/images/vinyl1.jpg", altText: "Album Vinyl" }
            //     ],
            //     categories: ["music", "collectibles", "limited-edition"],
            //     type: "limited-edition",
            //     inventory: {
            //         stock: 30,
            //         sku: "ABT-VINYL",
            //         barcode: "456789012345"
            //     },
            //     rating: {
            //         average: 5,
            //         count: 8
            //     },
            //     isFeatured: true,
            //     isLimitedEdition: true,
            //     tags: ["vinyl", "album", "limited"],
            //     shippingInfo: {
            //         weight: 300,
            //         dimensions: {
            //             length: 31,
            //             width: 31,
            //             height: 1
            //         }
            //     }
            // },
            // {
            //     name: "Davido Tour Poster",
            //     description: "Exclusive tour poster from Davido's latest world tour",
            //     price: 19.99,
            //     images: [
            //         { url: "https://example.com/images/poster1.jpg", altText: "Tour Poster" }
            //     ],
            //     categories: ["collectibles"],
            //     type: "exclusive",
            //     inventory: {
            //         stock: 120,
            //         sku: "POSTER-001",
            //         barcode: "567890123456"
            //     },
            //     rating: {
            //         average: 4.0,
            //         count: 12
            //     },
            //     isNew: true,
            //     tags: ["poster", "tour"],
            //     shippingInfo: {
            //         weight: 50,
            //         dimensions: {
            //             length: 60,
            //             width: 40,
            //             height: 0.5
            //         }
            //     }
            // }
        //];

        // Insert the sample products into the database
        const createdProducts = await ProductModel.insertMany(sampleProducts);

        res.status(200).json({
            message: 'Products added successfully',
            success: true,
            data: createdProducts,
            count: createdProducts.length
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Internal server error',
            success: false,
            error: error.message
        });
    }
}

// Get all products with filtering, sorting, and pagination
export const getProducts = async (req, res) => {
    try {
        // Extract query parameters
        const { 
            page = 1, 
            limit = 12, 
            category, 
            isFeatured, 
            isNew, 
            isLimitedEdition, 
            search, 
            sort = '-createdAt' 
        } = req.query;

        // Build the query object
        const query = {};
        
        // Category filter
        if (category) {
            query.categories = category;
        }
        
        // Boolean filters
        if (isFeatured) {
            query.isFeatured = isFeatured === 'true';
        }
        if (isNew) {
            query.isNew = isNew === 'true';
        }
        if (isLimitedEdition) {
            query.isLimitedEdition = isLimitedEdition === 'true';
        }
        
        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute query with pagination
        const products = await ProductModel.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Get total count for pagination
        const total = await ProductModel.countDocuments(query);
        res.status(200).json({
            success: true,
            data: products,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching products',
            error: error.message
        });
    }
};

// Get a single product by ID
export const getProductById = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });

    } catch (error) {
        console.error(error.message);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID format'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching product',
            error: error.message
        });
    }
};

// Get related products
export const getRelatedProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        const product = await ProductModel.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find products in the same category, excluding the current product
        const relatedProducts = await ProductModel.find({
            categories: { $in: product.categories },
            _id: { $ne: product._id }
        })
        .limit(limit)
        .exec();

        res.status(200).json({
            success: true,
            data: relatedProducts
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching related products',
            error: error.message
        });
    }
};

// Get featured products (shortcut endpoint)
export const getFeaturedProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        
        const featuredProducts = await ProductModel.find({ isFeatured: true })
            .sort('-rating.average')
            .limit(limit)
            .exec();

        res.status(200).json({
            success: true,
            data: featuredProducts
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching featured products',
            error: error.message
        });
    }
};

// Get new arrivals (shortcut endpoint)
export const getNewArrivals = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        
        const newArrivals = await ProductModel.find({ isNew: true })
            .sort('-createdAt')
            .limit(limit)
            .exec();

        res.status(200).json({
            success: true,
            data: newArrivals
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching new arrivals',
            error: error.message
        });
    }
};

// Get limited edition products (shortcut endpoint)
export const getLimitedEdition = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        
        const limitedEdition = await ProductModel.find({ isLimitedEdition: true })
            .sort('-createdAt')
            .limit(limit)
            .exec();

        res.status(200).json({
            success: true,
            data: limitedEdition
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching limited edition products',
            error: error.message
        });
    }
};