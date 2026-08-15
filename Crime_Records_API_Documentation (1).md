# Page 1

Crime Records of India Backend API Documentation Enterprise Backend
Documentation for Frontend Integration

------------------------------------------------------------------------

# Page 2

1.  Project Overview Crime Records of India is a scalable backend
    platform built using Node.js, Express.js, MySQL, Redis, Docker, and
    JWT Authentication. The backend provides dynamic dataset APIs,
    analytics APIs, governance APIs, admin audit logging, Redis caching,
    and authentication flows.
2.  Base URL Environment Base URL Local Development
    http://localhost:3000/api
3.  Authentication All protected APIs require JWT Authentication.
    Frontend must send access token in Authorization header.
    Authorization: Bearer ACCESS_TOKEN 3.1 User Login API Endpoint: POST
    /auth/login Request Body { "email": "test@test.com", "password":
    "User@123" } Sample Response { "success": true, "accessToken":
    "JWT_ACCESS_TOKEN", "refreshToken": "JWT_REFRESH_TOKEN", "user": {
    "id": 1, "username": "testuser", "email": "test@test.com" } } 3.2
    Admin Login API Endpoint: POST /auth/login-admin { "username":
    "superadmin", "password": "Admin@123" }
4.  Dataset APIs API Method Description /tables GET Get all available
    dataset tables /tables/:table/schema GET Get schema of dataset table
    /data/:table GET Get paginated table data /data/:table/search GET
    Search dataset records /data/:table/filter-options/:column GET Get
    distinct filter options 4.1 Get Table Data Endpoint: GET
    /data/:table?page=1&limit;=10 Example

------------------------------------------------------------------------

# Page 3

GET /data/auto_theft?page=1&limit=10 Sample Response { "success": true,
"table": "auto_theft", "page": 1, "limit": 10, "data": \[ { "Area_name":
"Delhi", "Year": 2001, "Auto_Theft_Stolen": 3185 } \] } 5. Analytics
APIs Endpoint: GET /analytics/overview Provides aggregated analytics for
dashboard and landing page. { "success": true, "totalUsers": 20,
"totalAdmins": 1, "totalTables": 17, "totalViews": 102, "totalSearches":
48 } 6. Admin Governance APIs API Method Purpose
/admin/table/:table/update PUT Update dataset rows
/admin/table/:table/delete DELETE Delete dataset rows Sample Update
Request { "conditions": { "Area_name": "Delhi", "Year": 2001 },
"newData": { "Auto_Theft_Stolen": 9999 } } 7. Redis Cache Layer API
Redis Cached TTL /tables Yes 30 Minutes /tables/:table/schema Yes 1 Hour
/analytics/overview Yes 5 Minutes 8. HTTP Status Codes Code Meaning 200
Success 201 Created Successfully 400 Bad Request

------------------------------------------------------------------------

# Page 4

401 Unauthorized 403 Forbidden 404 Resource Not Found 500 Internal
Server Error 9. Frontend Integration Notes  Store accessToken securely
after login.  Send Authorization header in protected APIs.  Use
pagination for large dataset tables.  Schema APIs should be used for
dynamic table rendering.  Analytics APIs are Redis cached for
performance.  Admin APIs require admin JWT token. Crime Records of
India - Backend Documentation
