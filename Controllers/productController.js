const pool = require('../db');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');

class ProductController {
    async addNew(req, res) {
        try {
            const { supplierId, categoryId, measureUnitId, productName, available, description, storageConditions } = req.body;
            const { img } = req.files;

            const returnData = await pool.query("INSERT INTO products (supplier_id, category_id, measure_unit_id, product_name, available, description, storage_conditions) VALUES ($1, $2, $3, $4, $5, $6, $7)  RETURNING *;", [supplierId, categoryId, measureUnitId, productName, available, description, storageConditions]);
            const productId = returnData.rows[0].product_id;

            if (Array.isArray(img)) {
                img.forEach((element, i) => {
                    let fileName = uuid.v4() + '.png'; 
                    let filePath = path.resolve(__dirname, '..', 'public', fileName);            
                    element.mv(filePath);

                    let altPhotoText = req.body[i + 1];

                    pool.query("INSERT INTO product_photos(product_id, photo_name, url, alternative_text) VALUES ($1, $2, $3, $4)", [productId, fileName, filePath, altPhotoText]);
                });
            } else {
                const fileName = uuid.v4() + '.png'; 
                const filePath = path.resolve(__dirname, '..', 'public', fileName);            
                img.mv(filePath);

                let altPhotoText = req.body[1];

                pool.query("INSERT INTO product_photos(product_id, photo_name, url, alternative_text) VALUES ($1, $2, $3, $4)", [productId, fileName, filePath, altPhotoText]);
            }          

            res.status(200).json({message: 'Новый продукт был успешно добавлен!'});


        } catch (err) {
            console.error(err.message);
            res.status(404).json({message: 'Что-то пошло не так :('});
        }
    }

    async get(req, res) {
        try {
            const { id } = req.params;

            const queryProductResult = await pool.query("SELECT products.product_id, products.product_name, products.available, products.description, products.storage_conditions, category.category_name, suppliers.company_name, measure_units.measure_name FROM products LEFT OUTER JOIN suppliers ON products.supplier_id = suppliers.supplier_id LEFT OUTER JOIN category ON products.category_id = category.category_id LEFT OUTER JOIN measure_units ON products.measure_unit_id = measure_units.measure_unit_id           WHERE product_id = $1", [id]);

            const queryPhotoResult = await pool.query("SELECT * FROM product_photos WHERE product_id = $1", [id]);

            const queryResult = {
                product: queryProductResult.rows[0], 
                photos: queryPhotoResult.rows
            };

            res.status(200).json(queryResult);

        } catch (err) {
            console.log(err);
            res.status(404).json({message: 'Что-то пошло не так :('});
        }

    }

    async getAll(req, res) {
        const { categoryId, supplierId } = req.query; 
        let { limit, currentPage } = req.query;
        limit = limit || 6;
        currentPage = currentPage || 1;
        
        let offset = currentPage * limit - limit;

        let queryResult = null;
        let productNumber = null;
                 
        if (categoryId && supplierId) {

            productNumber = await pool.query("SELECT COUNT(*) FROM products WHERE products.category_id = $1 AND products.supplier_id = $2", [categoryId, supplierId]); 

            queryResult = await pool.query("SELECT products.product_id, products.product_name, products.available, products.description, products.storage_conditions, category.category_name, suppliers.company_name, measure_units.measure_name FROM products LEFT OUTER JOIN suppliers ON products.supplier_id = suppliers.supplier_id LEFT OUTER JOIN category ON products.category_id = category.category_id LEFT OUTER JOIN measure_units ON products.measure_unit_id = measure_units.measure_unit_id WHERE products.category_id = $1 AND products.supplier_id = $2 OFFSET $2 ROWS FETCH FIRST $3 ROW ONLY", [categoryId, supplierId, offset, limit]);          
            
        } else if (categoryId && !supplierId) {

            productNumber = await pool.query("SELECT COUNT(*) FROM products WHERE products.category_id = $1", [categoryId]); 

            queryResult = await pool.query("SELECT products.product_id, products.product_name, products.available, products.description, products.storage_conditions, category.category_name, suppliers.company_name, measure_units.measure_name FROM products LEFT OUTER JOIN suppliers ON products.supplier_id = suppliers.supplier_id LEFT OUTER JOIN category ON products.category_id = category.category_id LEFT OUTER JOIN measure_units ON products.measure_unit_id = measure_units.measure_unit_id WHERE products.category_id = $1 OFFSET $2 ROWS FETCH FIRST $3 ROW ONLY", [categoryId, offset, limit]);
            
        } else if (!categoryId && supplierId) {

            productNumber = await pool.query("SELECT COUNT(*) FROM products WHERE products.supplier_id = $1", [supplierId]); 

            queryResult = await pool.query("SELECT products.product_id, products.product_name, products.available, products.description, products.storage_conditions, category.category_name, suppliers.company_name, measure_units.measure_name FROM products LEFT OUTER JOIN suppliers ON products.supplier_id = suppliers.supplier_id LEFT OUTER JOIN category ON products.category_id = category.category_id LEFT OUTER JOIN measure_units ON products.measure_unit_id = measure_units.measure_unit_id WHERE products.supplier_id = $1 OFFSET $2 ROWS FETCH FIRST $3 ROW ONLY", [supplierId, offset, limit]);
                        
        } else if (!categoryId && !supplierId) {

            productNumber = await pool.query("SELECT COUNT(*) FROM products"); 

            queryResult = await pool.query("SELECT products.product_id, products.product_name, products.available, products.description, products.storage_conditions, category.category_name, suppliers.company_name, measure_units.measure_name FROM products LEFT OUTER JOIN suppliers ON products.supplier_id = suppliers.supplier_id LEFT OUTER JOIN category ON products.category_id = category.category_id LEFT OUTER JOIN measure_units ON products.measure_unit_id = measure_units.measure_unit_id OFFSET $1 ROWS FETCH FIRST $2 ROW ONLY", [offset, limit]);            
            
        }
        
        let outInfo = {};
        outInfo.productNamber = productNumber.rows[0].count;
        outInfo.products = queryResult.rows;

        res.status(200).json(outInfo);
    }

    async delete(req, res) {
        try {
            const { id } = req.params;

            let productPhotos = await pool.query("SELECT photo_name FROM product_photos WHERE product_id = $1;", [id]);
            productPhotos = productPhotos.rows;

            productPhotos.forEach(element => {
                let fileName = element.photo_name; 
                let filePath = path.resolve(__dirname, '..', 'public', fileName); 

                fs.unlink(filePath, (err) => {
                    if (err) throw err;              
                });
            });

            await pool.query("DELETE FROM product_photos WHERE product_id = $1", [id]);
            await pool.query("DELETE FROM products WHERE product_id = $1", [id]);

            res.status(200).json({message: 'Данный продукт был успешно удален!'});

        } catch (err) {
            console.log(err);
            res.status(404).json({message: 'Что-то пошло не так :('});
        }
    }
}

module.exports = new ProductController();