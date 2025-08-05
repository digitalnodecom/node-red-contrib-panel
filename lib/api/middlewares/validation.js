const Joi = require('joi');

const collectionSchema = Joi.object({
    name: Joi.string()
        .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .min(1)
        .max(64)
        .required()
        .messages({
            'string.pattern.base': 'Collection name must start with a letter and contain only letters, numbers, and underscores'
        }),
    events_enabled: Joi.boolean().default(false),
    fields: Joi.array().items(
        Joi.object({
            name: Joi.string()
                .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
                .min(1)
                .max(64)
                .required(),
            type: Joi.string()
                .valid('text', 'number', 'integer', 'boolean', 'date', 'json', 'email', 'url')
                .required(),
            required: Joi.boolean().default(false),
            unique: Joi.boolean().default(false),
            indexable: Joi.boolean().default(false),
            default: Joi.any().optional(),
            options: Joi.object().optional()
        })
    ).min(1).required()
});

const validateCollection = (req, res, next) => {
    const { error } = collectionSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            error: 'Validation error',
            details: error.details.map(d => d.message)
        });
    }
    
    next();
};

const validateRecord = (req, res, next) => {
    // Check if this is an upsert request
    if (req.path.endsWith('/upsert')) {
        return validateUpsertRequest(req, res, next);
    }
    
    // Basic validation - ensure req.body is an object
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
            error: 'Invalid request body'
        });
    }
    
    // Additional validation can be added here based on collection schema
    // For now, we'll do the schema validation in the controller
    next();
};

const validateUpsertRequest = (req, res, next) => {
    const upsertSchema = Joi.object({
        data: Joi.object().required().messages({
            'any.required': 'Data object is required',
            'object.base': 'Data must be an object'
        }),
        matchFields: Joi.array()
            .items(Joi.string().min(1))
            .min(1)
            .required()
            .messages({
                'any.required': 'matchFields array is required',
                'array.base': 'matchFields must be an array',
                'array.min': 'At least one match field is required'
            }),
        mode: Joi.string()
            .valid('upsert', 'updateOnly', 'insertOnly')
            .default('upsert')
            .messages({
                'any.only': 'Mode must be one of: upsert, updateOnly, insertOnly'
            })
    });
    
    const { error, value } = upsertSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            error: 'Validation error',
            details: error.details.map(d => d.message)
        });
    }
    
    // Replace req.body with validated/transformed data
    req.body = value;
    next();
};

module.exports = {
    validateCollection,
    validateRecord
};