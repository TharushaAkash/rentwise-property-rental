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
  final String ownerId;
  final Map<String, dynamic> owner;
  final List<String> photos;
  final List<String> facilities;
  final List<String> featureTags;
  final Map<String, dynamic> raw;

  String get city =>
      (raw['city'] ?? raw['City'] ?? (address.contains(',') ? address.split(',').last : address))
          .toString()
          .trim();

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
    this.ownerId = '',
    this.owner = const {},
    this.photos = const [],
    this.facilities = const [],
    this.featureTags = const [],
    this.raw = const {},
  });

  factory PropertyModel.fromJson(Map<String, dynamic> json) {
    json = {
      for (final entry in json.entries)
        '${entry.key[0].toLowerCase()}${entry.key.substring(1)}': entry.value,
    };
    final photoEntries = List<dynamic>.from(json['photos'] as List? ?? []);
    photoEntries.sort((a, b) {
      int primary(dynamic p) =>
          p is Map && (p['isPrimary'] == true || p['IsPrimary'] == true)
          ? 1
          : 0;
      return primary(b).compareTo(primary(a));
    });
    final photos = photoEntries
        .map(
          (p) => p is String
              ? p
              : p is Map
              ? (p['photoUrl'] ?? p['PhotoUrl'] ?? p['url'] ?? '').toString()
              : '',
        )
        .where((p) => p.isNotEmpty)
        .toSet()
        .toList();
    final pUrl = photos.isEmpty ? '' : photos.first;
    num number(dynamic value) => num.tryParse(value?.toString() ?? '') ?? 0;

    return PropertyModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      address: json['address'] ?? '',
      monthlyRent: number(json['monthlyRent']).toDouble(),
      bedrooms: number(json['bedrooms']).toInt(),
      bathrooms: number(json['bathrooms']).toInt(),
      sqft: number(json['sqft']).toInt(),
      propertyType: json['propertyType'] ?? 'Apartment',
      status: switch (json['status']?.toString()) {
        '0' => 'PendingVerification',
        '1' => 'Active',
        '2' => 'Suspended',
        final String s => s,
        _ => 'PendingVerification',
      },
      photoUrl: pUrl.isEmpty ? json['photoUrl'] ?? '' : pUrl,
      ownerId: json['ownerId']?.toString() ?? '',
      owner: Map<String, dynamic>.from(json['owner'] ?? {}),
      photos: photos,
      facilities:
          (json['facilities'] is List
                  ? (json['facilities'] as List).join(',')
                  : json['facilities']?.toString() ?? '')
              .split(',')
              .map((s) => s.trim())
              .where((s) => s.isNotEmpty)
              .toList(),
      featureTags: (json['featureTags'] as List? ?? [])
          .map((s) => s.toString())
          .toList(),
      raw: json,
    );
  }
}
