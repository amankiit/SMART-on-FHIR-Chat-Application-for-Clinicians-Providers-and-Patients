const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('./smartConfig');

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function decodeIdToken(idToken) {
  if (!idToken) return null;
  try {
    return jwt.decode(idToken);
  } catch (e) {
    return null;
  }
}

async function getCurrentFhirUser(accessToken, idToken) {
  const decoded = decodeIdToken(idToken);
  const fhirUser = decoded?.fhirUser || decoded?.extension_fhirUser;
  if (!fhirUser) return null;

  const url = fhirUser.startsWith('http')
    ? fhirUser
    : `${config.fhirBaseUrl}/${fhirUser.replace(/^\//, '')}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json'
      }
    });
    return response.data;
  } catch (err) {
    console.error('Error loading fhirUser resource:', err.response?.data || err.message);
    return null;
  }
}

function normalizeFhirUser(userResource) {
  if (!userResource) return null;
  let displayName = 'Unknown';
  if (userResource.name && userResource.name.length > 0) {
    const n = userResource.name[0];
    const given = n.given ? n.given.join(' ') : '';
    const family = n.family || '';
    displayName = `${given} ${family}`.trim() || 'Unknown';
  } else if (userResource.practitionerRole && userResource.practitionerRole[0]?.practitioner?.display) {
    displayName = userResource.practitionerRole[0].practitioner.display;
  }

  return {
    id: userResource.id,
    resourceType: userResource.resourceType,
    name: displayName
  };
}

async function makeFHIRRequest(accessToken, resource, params = {}) {
  try {
    const response = await axios.get(`${config.fhirBaseUrl}/${resource}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json'
      },
      params
    });
    return response.data;
  } catch (error) {
    console.error(`FHIR ${resource} error:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  config,
  generatePKCE,
  getCurrentFhirUser,
  normalizeFhirUser,
  makeFHIRRequest
};
