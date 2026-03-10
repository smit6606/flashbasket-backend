export const MSG = {
  /* ==========================
     AUTHENTICATION
  ========================== */
  AUTH: {
    LOGIN_SUCCESS: "Login successful.",
    LOGIN_FAILED: "Invalid credentials.",
    REGISTER_SUCCESS: "Account created successfully.",
    LOGOUT_SUCCESS: "Logged out successfully.",
    INVALID_ROLE: "Please provide a valid role.",
  },

  /* ==========================
     AUTHORIZATION / ACCESS
  ========================== */
  ACCESS: {
    UNAUTHORIZED: "Authentication required. Please login.",
    FORBIDDEN: "You do not have permission to perform this action.",
    TOKEN_MISSING: "Authentication token is missing.",
    TOKEN_INVALID: "Invalid or expired authentication token.",
    TOKEN_DELETED: "Token is no longer valid. User does not exist.",
    ACCESS_DENIED: "Access denied.",
  },

  /* ==========================
     USER MANAGEMENT (CRUD)
  ========================== */
  USER: {
    CREATED: "User registered successfully.",
    UPDATED: "User updated successfully.",
    DELETED: "User deleted successfully.",
    FETCHED: "User details retrieved successfully.",
    FETCHED_ALL: "Users retrieved successfully.",
    PROFILE_FETCHED: "Profile retrieved successfully.",
    PROFILE_UPDATED: "Profile updated successfully.",
    PROFILE_DELETED: "Profile deleted successfully.",
  },

  /* ==========================
     CART MANAGEMENT
  ========================== */
  CART: {
    ADDED: "Product added to cart.",
    UPDATED: "Cart quantity updated.",
    REMOVED: "Product removed from cart.",
    FETCHED: "Cart items retrieved successfully.",
    NOT_FOUND: "Cart item not found.",
    EMPTY: "Your cart is empty.",
  },

  USER_ERROR: {
    NOT_FOUND: "User not found.",
    ALREADY_EXISTS: "User already exists.",
    EMAIL_EXISTS: "User with same email already exists.",
    USERNAME_EXISTS: "User with same username already exists.",
    PHONE_EXISTS: "User with same mobile number already exists.",
    INVALID_CREDENTIALS: "Invalid user credentials.",
    VALIDATION_FAILED: "User validation failed.",
  },

  /* ==========================
     VALIDATION & REQUEST
  ========================== */
  REQUEST: {
    BAD_REQUEST: "Invalid request data.",
    MISSING_FIELDS: "Required fields are missing.",
    MISSING_NAME: "Name is required.",
    MISSING_EMAIL: "Email is required.",
    MISSING_PHONE: "Phone number is required.",
    MISSING_PASSWORD: "Password is required.",
  },

  /* ==========================
     CATEGORY MANAGEMENT
  ========================== */
  CATEGORY: {
    CREATED: "Category created successfully.",
    FETCHED: "Categories retrieved successfully.",
    SUBCATEGORY_CREATED: "SubCategory created successfully.",
  },

  /* ==========================
     PRODUCT MANAGEMENT
  ========================== */
  PRODUCT: {
    CREATED: "Product created successfully.",
    UPDATED: "Product updated successfully.",
    DELETED: "Product deleted successfully.",
    FETCHED: "Product details retrieved successfully.",
    FETCHED_ALL: "Products retrieved successfully.",
    NOT_FOUND: "Product not found.",
    UNAUTHORIZED: "You are not authorized to manage this product.",
    SELLER_ONLY: "Only sellers can perform this action.",
  },

  /* ==========================
     DATABASE / SERVER
  ========================== */
  SERVER: {
    INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
    DATABASE_ERROR: "Database operation failed.",
    ACTION_SUCCESS: "Operation completed successfully.",
  },
};
