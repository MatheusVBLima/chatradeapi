import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class RadeAuthService {
  private readonly logger = new Logger(RadeAuthService.name);
  private accessToken: string;
  private tokenExpiry: Date;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? process.env.RADE_API_BASE_URL || 'https://api.radeapp.com'
      : 'https://api.stg.radeapp.com';

    this.logger.log(`RADE Auth Service initialized for: ${this.baseURL}`);
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    // In staging/development, use the fixed token
    if (process.env.NODE_ENV !== 'production') {
      const stagingToken = process.env.RADE_API_TOKEN;
      if (!stagingToken) {
        throw new Error('RADE_API_TOKEN environment variable is required for staging/development');
      }
      this.logger.debug('Using staging token');
      return stagingToken;
    }

    // In production, handle dynamic token
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }

    return this.accessToken;
  }

  /**
   * Refresh the authentication token
   * This method needs to be implemented based on RADE's auth mechanism
   */
  private async refreshToken(): Promise<void> {
    try {
      this.logger.log('Refreshing RADE authentication token...');

      // OPTION 1: If RADE has username/password authentication
      if (process.env.RADE_USERNAME && process.env.RADE_PASSWORD) {
        await this.authenticateWithCredentials();
        return;
      }

      // OPTION 2: If RADE has client credentials flow
      if (process.env.RADE_CLIENT_ID && process.env.RADE_CLIENT_SECRET) {
        await this.authenticateWithClientCredentials();
        return;
      }

      // OPTION 3: If RADE provides a fixed application token
      if (process.env.RADE_API_TOKEN) {
        this.accessToken = process.env.RADE_API_TOKEN;
        // Set expiry far in the future for fixed tokens
        this.tokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        this.logger.log('Using fixed API token from environment');
        return;
      }

      throw new Error('No RADE authentication method configured');

    } catch (error) {
      this.logger.error('Failed to refresh RADE token:', error.message);
      throw new Error(`RADE authentication failed: ${error.message}`);
    }
  }

  /**
   * Authenticate using username/password
   */
  private async authenticateWithCredentials(): Promise<void> {
    const response = await axios.post(`${this.baseURL}/auth/login`, {
      username: process.env.RADE_USERNAME,
      password: process.env.RADE_PASSWORD,
    });

    if (response.data.token) {
      this.accessToken = response.data.token;
      
      // Calculate expiry based on response or default to 1 hour
      const expiresIn = response.data.expiresIn || 3600; // seconds
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      
      this.logger.log('Successfully authenticated with RADE using credentials');
    } else {
      throw new Error('No token returned from RADE auth endpoint');
    }
  }

  /**
   * Authenticate using client credentials (OAuth2-style)
   */
  private async authenticateWithClientCredentials(): Promise<void> {
    const response = await axios.post(`${this.baseURL}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: process.env.RADE_CLIENT_ID,
      client_secret: process.env.RADE_CLIENT_SECRET,
    });

    if (response.data.access_token) {
      this.accessToken = response.data.access_token;
      
      // Calculate expiry
      const expiresIn = response.data.expires_in || 3600; // seconds
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      
      this.logger.log('Successfully authenticated with RADE using client credentials');
    } else {
      throw new Error('No access token returned from RADE OAuth endpoint');
    }
  }

  /**
   * Check if current token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.accessToken) {
      return true;
    }

    if (!this.tokenExpiry) {
      return true;
    }

    // Add 5 minute buffer before actual expiry
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return new Date() >= new Date(this.tokenExpiry.getTime() - bufferTime);
  }

  /**
   * Get current token status for health checks
   */
  getTokenStatus() {
    return {
      hasToken: !!this.accessToken,
      isExpired: this.isTokenExpired(),
      expiresAt: this.tokenExpiry?.toISOString() || null,
      environment: process.env.NODE_ENV || 'development',
      baseURL: this.baseURL,
    };
  }

  /**
   * Force token refresh (useful for testing)
   */
  async forceRefresh(): Promise<void> {
    this.accessToken = '';
    this.tokenExpiry = new Date(0);
    await this.refreshToken();
  }
}