

const config = {
  clientId: process.env.SMART_CLIENT_ID,
  clientSecret: process.env.SMART_CLIENT_SECRET,
  redirectUri: 'http://localhost:5000/redirect',
  authorizationEndpoint: 'http://localhost:8080/oauth2/default/authorize',
  tokenEndpoint: 'http://localhost:8080/oauth2/default/token',
  fhirBaseUrl: 'http://localhost:8080/apis/default/fhir',
  scope: process.env.SMART_SCOPE || 'openid launch fhirUser user/Patient.read user/Observation.read user/Condition.read user/MedicationRequest.read user/DiagnosticReport.read user/AllergyIntolerance.read user/Practitioner.read user/Person.read offline_access'
};

module.exports = config;