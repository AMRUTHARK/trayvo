/**
 * Utility functions to extract device and browser information from user agent
 */

/**
 * Parse user agent string to extract device, browser, and OS information
 * @param {string} userAgent - User agent string from request
 * @returns {object} Device information object
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      deviceType: 'Unknown',
      browser: 'Unknown',
      os: 'Unknown',
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType = 'Desktop';
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  }

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer';
  }

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) {
    if (ua.includes('windows nt 10')) {
      os = 'Windows 10/11';
    } else if (ua.includes('windows nt 6.3')) {
      os = 'Windows 8.1';
    } else if (ua.includes('windows nt 6.2')) {
      os = 'Windows 8';
    } else if (ua.includes('windows nt 6.1')) {
      os = 'Windows 7';
    } else {
      os = 'Windows';
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    const androidVersion = ua.match(/android\s([0-9\.]*)/);
    os = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    const iosVersion = ua.match(/os\s([0-9_]*)/);
    os = iosVersion ? `iOS ${iosVersion[1].replace(/_/g, '.')}` : 'iOS';
  }

  return {
    deviceType,
    browser,
    os,
  };
}

/**
 * Get client IP address from request
 * @param {object} req - Express request object
 * @returns {string} IP address
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'Unknown'
  );
}

module.exports = {
  parseUserAgent,
  getClientIp,
};

