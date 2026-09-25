class ApiConstants {
  // If running on Android Emulator, localhost is 10.0.2.2
  // If running on iOS Simulator, localhost is 127.0.0.1
  static const String baseUrl = 'http://10.0.2.2:5000/api';
  
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
}
