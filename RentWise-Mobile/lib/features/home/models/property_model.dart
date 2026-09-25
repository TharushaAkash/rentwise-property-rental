class PropertyModel {
  final String id;
  final String title;
  final String description;
  final String address;
  final double monthlyRent;
  final int bedrooms;
  final int bathrooms;
  final int sqft;
  final String propertyType;
  final String status;
  final String photoUrl; // For convenience

  PropertyModel({
    required this.id,
    required this.title,
    required this.description,
    required this.address,
    required this.monthlyRent,
    required this.bedrooms,
    required this.bathrooms,
    required this.sqft,
    required this.propertyType,
    required this.status,
    required this.photoUrl,
  });

  factory PropertyModel.fromJson(Map<String, dynamic> json) {
    // Determine a primary photo URL if there are photos
    String pUrl = '';
    if (json['photos'] != null && json['photos'] is List && json['photos'].isNotEmpty) {
      pUrl = json['photos'][0]['photoUrl'] ?? '';
    }

    return PropertyModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      address: json['address'] ?? '',
      monthlyRent: (json['monthlyRent'] ?? 0).toDouble(),
      bedrooms: json['bedrooms'] ?? 0,
      bathrooms: json['bathrooms'] ?? 0,
      sqft: json['sqft'] ?? 0,
      propertyType: json['propertyType'] ?? 'Apartment',
      status: json['status']?.toString() ?? 'Pending',
      photoUrl: pUrl,
    );
  }
}
