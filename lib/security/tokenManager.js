const crypto = require('crypto');

class TokenManager {
    constructor() {
        this.internalToken = null;
        this.tokenRotationInterval = null;
    }
    
    // Generate a secure internal token for Node-RED editor communication
    generateInternalToken() {
        this.internalToken = crypto.randomBytes(32).toString('hex');
        console.log('Panel: Generated new internal authentication token');
        return this.internalToken;
    }
    
    // Get the current internal token
    getInternalToken() {
        return this.internalToken;
    }
    
    // Start automatic token rotation (optional security feature)
    startTokenRotation(intervalHours = 24) {
        if (this.tokenRotationInterval) {
            clearInterval(this.tokenRotationInterval);
        }
        
        // Rotate token every N hours
        const intervalMs = intervalHours * 60 * 60 * 1000;
        this.tokenRotationInterval = setInterval(() => {
            this.generateInternalToken();
        }, intervalMs);
        
        console.log(`Panel: Token rotation enabled (every ${intervalHours} hours)`);
    }
    
    // Stop automatic token rotation
    stopTokenRotation() {
        if (this.tokenRotationInterval) {
            clearInterval(this.tokenRotationInterval);
            this.tokenRotationInterval = null;
            console.log('Panel: Token rotation disabled');
        }
    }
    
    // Generate a secure API key for external clients
    generateApiKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    // Hash an API key for secure storage
    hashApiKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
    
    // Validate an API key against its hash
    validateApiKeyHash(key, hash) {
        const keyHash = this.hashApiKey(key);
        return crypto.timingSafeEqual(
            Buffer.from(keyHash, 'hex'),
            Buffer.from(hash, 'hex')
        );
    }
    
    // Generate a secure session token (if needed for custom sessions)
    generateSessionToken() {
        return crypto.randomBytes(48).toString('hex');
    }
    
    // Create a signed token with expiration (JWT-like but simpler)
    createSignedToken(payload, secretKey, expirationHours = 24) {
        const expires = Date.now() + (expirationHours * 60 * 60 * 1000);
        const tokenData = {
            payload,
            expires,
            issued: Date.now()
        };
        
        const tokenString = JSON.stringify(tokenData);
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(tokenString)
            .digest('hex');
            
        return Buffer.from(tokenString + '.' + signature).toString('base64');
    }
    
    // Verify a signed token
    verifySignedToken(token, secretKey) {
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            const [tokenString, signature] = decoded.split('.');
            
            // Verify signature
            const expectedSignature = crypto
                .createHmac('sha256', secretKey)
                .update(tokenString)
                .digest('hex');
                
            if (!crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            )) {
                return null; // Invalid signature
            }
            
            const tokenData = JSON.parse(tokenString);
            
            // Check expiration
            if (Date.now() > tokenData.expires) {
                return null; // Token expired
            }
            
            return tokenData.payload;
        } catch (error) {
            return null; // Invalid token format
        }
    }
    
    // Generate a random string for various purposes
    generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    // Clean up on shutdown
    cleanup() {
        this.stopTokenRotation();
        this.internalToken = null;
    }
}

// Singleton instance
const tokenManager = new TokenManager();

module.exports = tokenManager;