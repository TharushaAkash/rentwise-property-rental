class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phoneNumber;
  final String? nicNumber;
  final String token;
  final bool isNicVerified;
  final String? nicImageUrl;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phoneNumber,
    this.nicNumber,
    required this.token,
    this.isNicVerified = false,
    this.nicImageUrl,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // If the response is wrapped in an AuthResponseDto format (has 'user' and 'token')
    if (json.containsKey('user') && json['user'] is Map) {
      final userObj = json['user'];
      return UserModel(
        id: userObj['id']?.toString() ?? '',
        name: userObj['name'] ?? '',
        email: userObj['email'] ?? '',
        role: userObj['role'] ?? 'Tenant',
        phoneNumber: userObj['phoneNumber'],
        nicNumber: userObj['nicNumber'],
        isNicVerified: userObj['isNicVerified'] == true,
        nicImageUrl: userObj['nicImageUrl'],
        token: json['token'] ?? '',
      );
    }

    // Fallback for direct user object
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'Tenant',
      phoneNumber: json['phoneNumber'],
      nicNumber: json['nicNumber'],
      isNicVerified: json['isNicVerified'] == true,
      nicImageUrl: json['nicImageUrl'],
      token: json['token'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'phoneNumber': phoneNumber,
      'nicNumber': nicNumber,
      'token': token,
      'isNicVerified': isNicVerified,
      'nicImageUrl': nicImageUrl,
    };
  }
}
