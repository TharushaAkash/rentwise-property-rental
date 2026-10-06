class AgreementModel {
  final String id;
  final String propertyId;
  final String ownerId;
  final String tenantId;
  final double agreedMonthlyRent;
  final double securityDeposit;
  final String startDate;
  final String endDate;
  final String status; // Drafted | PendingOwnerApproval | Active | Expired
  final String termsAndConditions;
  final Map<String, dynamic> property;
  final Map<String, dynamic> owner;
  final Map<String, dynamic> tenant;
  final List<PaymentModel> payments;

  AgreementModel({
    required this.id,
    required this.propertyId,
    required this.ownerId,
    required this.tenantId,
    required this.agreedMonthlyRent,
    required this.securityDeposit,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.termsAndConditions,
    this.property = const {},
    this.owner = const {},
    this.tenant = const {},
    this.payments = const [],
  });

  factory AgreementModel.fromJson(Map<String, dynamic> json) {
    // Normalize keys to camelCase
    final raw = <String, dynamic>{};
    for (final e in json.entries) {
      final key = e.key.isEmpty
          ? e.key
          : '${e.key[0].toLowerCase()}${e.key.substring(1)}';
      raw[key] = e.value;
    }

    final statusRaw = raw['status'];
    String statusStr;
    if (statusRaw is int) {
      statusStr = switch (statusRaw) {
        0 => 'Drafted',
        1 => 'PendingOwnerApproval',
        2 => 'Active',
        3 => 'Expired',
        _ => 'Drafted',
      };
    } else {
      statusStr = statusRaw?.toString() ?? 'Drafted';
    }

    num toNum(dynamic v) => num.tryParse(v?.toString() ?? '') ?? 0;

    final paymentsList = <PaymentModel>[];
    final rawPayments = raw['payments'] as List?;
    if (rawPayments != null) {
      for (final p in rawPayments) {
        if (p is Map<String, dynamic>) {
          paymentsList.add(PaymentModel.fromJson(p));
        }
      }
    }

    return AgreementModel(
      id: raw['id']?.toString() ?? '',
      propertyId: raw['propertyId']?.toString() ?? '',
      ownerId: raw['ownerId']?.toString() ?? '',
      tenantId: raw['tenantId']?.toString() ?? '',
      agreedMonthlyRent: toNum(raw['agreedMonthlyRent'] ?? raw['monthlyRent'])
          .toDouble(),
      securityDeposit: toNum(raw['securityDeposit']).toDouble(),
      startDate: raw['startDate']?.toString() ?? '',
      endDate: raw['endDate']?.toString() ?? '',
      status: statusStr,
      termsAndConditions: raw['termsAndConditions']?.toString() ?? '',
      property: raw['property'] is Map
          ? Map<String, dynamic>.from(raw['property'] as Map)
          : {},
      owner: raw['owner'] is Map
          ? Map<String, dynamic>.from(raw['owner'] as Map)
          : {},
      tenant: raw['tenant'] is Map
          ? Map<String, dynamic>.from(raw['tenant'] as Map)
          : {},
      payments: paymentsList,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'propertyId': propertyId,
    'ownerId': ownerId,
    'tenantId': tenantId,
    'agreedMonthlyRent': agreedMonthlyRent,
    'securityDeposit': securityDeposit,
    'startDate': startDate,
    'endDate': endDate,
    'status': status,
    'termsAndConditions': termsAndConditions,
    'property': property,
    'owner': owner,
    'tenant': tenant,
    'payments': payments.map((p) => p.toJson()).toList(),
  };

  Map<String, dynamic> toMap() => toJson();

  // Computed helpers
  bool get hasPaid {
    final terms = termsAndConditions;
    return terms.contains('[PAYMENT_SUCCESS') ||
        payments.any((p) => p.isSuccessful);
  }

  bool get hasAgreed {
    return hasPaid ||
        termsAndConditions.contains('[TENANT_AGREED') ||
        status == 'PendingOwnerApproval' ||
        status == 'Active';
  }

  /// 1 = Sent/Drafted, 2 = Agreed (payment needed), 3 = Paid & Active
  int get lifecycleStep {
    if (hasPaid) return 3;
    if (hasAgreed) return 2;
    return 1;
  }

  String get propertyTitle =>
      property['title']?.toString() ??
      property['Title']?.toString() ??
      'Rental Property';

  String get propertyAddress =>
      property['address']?.toString() ?? property['Address']?.toString() ?? '';

  String get propertyPhoto {
    final photos = property['photos'] as List?;
    if (photos != null && photos.isNotEmpty) {
      final first = photos.first;
      if (first is Map) {
        return first['photoUrl']?.toString() ??
            first['PhotoUrl']?.toString() ??
            '';
      }
      return first?.toString() ?? '';
    }
    return property['photoUrl']?.toString() ??
        property['PhotoUrl']?.toString() ??
        '';
  }

  String get ownerName =>
      owner['fullName']?.toString() ??
      owner['name']?.toString() ??
      owner['email']?.toString() ??
      'Owner';

  String get tenantName =>
      tenant['fullName']?.toString() ??
      tenant['name']?.toString() ??
      tenant['email']?.toString() ??
      'Tenant';
}

class PaymentModel {
  final String purpose;
  String get purposeLabel => purpose == "SecurityDeposit"
      ? "Security deposit"
      : purpose == "MonthlyRent"
      ? "Monthly rent"
      : "Other payment";
  final String id;
  final String agreementId;
  final double amount;
  final String paymentMethod;
  final String paymentReference;
  final bool isSuccessful;
  final String paidAt;

  PaymentModel({
    this.purpose = "Unspecified",
    required this.id,
    required this.agreementId,
    required this.amount,
    required this.paymentMethod,
    required this.paymentReference,
    required this.isSuccessful,
    required this.paidAt,
  });

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    final raw = <String, dynamic>{};
    for (final e in json.entries) {
      final key = e.key.isEmpty
          ? e.key
          : '${e.key[0].toLowerCase()}${e.key.substring(1)}';
      raw[key] = e.value;
    }
    num toNum(dynamic v) => num.tryParse(v?.toString() ?? '') ?? 0;
    return PaymentModel(
      purpose:
          raw["purpose"]?.toString().isNotEmpty == true &&
              raw["purpose"] != "Unspecified"
          ? raw["purpose"].toString()
          : (raw["paymentReference"]?.toString().startsWith("RENT-") == true
                ? "MonthlyRent"
                : raw["paymentReference"]?.toString().startsWith("PAY-") == true
                ? "SecurityDeposit"
                : "Unspecified"),
      id: raw['id']?.toString() ?? '',
      agreementId:
          (raw['rentalAgreementId'] ?? raw['agreementId'])?.toString() ?? '',
      amount: toNum(raw['amount']).toDouble(),
      paymentMethod: raw['paymentMethod']?.toString() ?? '',
      paymentReference: raw['paymentReference']?.toString() ?? '',
      isSuccessful: raw['isSuccessful'] == true || raw['isSuccessful'] == 1,
      paidAt:
          (raw['paymentDate'] ?? raw['paidAt'] ?? raw['createdAt'])
              ?.toString() ??
          '',
    );
  }

  Map<String, dynamic> toJson() => {
    'purpose': purpose,
    'id': id,
    'agreementId': agreementId,
    'amount': amount,
    'paymentMethod': paymentMethod,
    'paymentReference': paymentReference,
    'isSuccessful': isSuccessful,
    'paidAt': paidAt,
  };

  Map<String, dynamic> toMap() => toJson();
}
