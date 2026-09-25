class MaintenanceModel {
  final String id;
  final String description;
  final String propertyTitle;
  final String photoUrl;
  final String status;
  final String priority;
  final DateTime createdAt;

  MaintenanceModel({
    required this.id,
    required this.description,
    required this.propertyTitle,
    required this.photoUrl,
    required this.status,
    required this.priority,
    required this.createdAt,
  });

  factory MaintenanceModel.fromJson(Map<String, dynamic> json) {
    String parsedStatus = 'Pending';
    if (json['status'] != null) {
      parsedStatus = json['status'].toString();
    }

    return MaintenanceModel(
      id: json['id'] ?? '',
      description: json['description'] ?? '',
      propertyTitle: json['property'] != null ? json['property']['title'] ?? 'Unknown Property' : 'Unknown Property',
      photoUrl: json['photoUrl'] ?? '',
      status: parsedStatus,
      priority: json['aiPriority'] ?? 'Normal',
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
    );
  }
}
