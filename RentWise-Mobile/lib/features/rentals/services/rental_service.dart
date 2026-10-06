import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../shared/utils/api_constants.dart';
import '../../../shared/services/token_store.dart';
import '../models/rental_model.dart';

class RentalService {
  final http.Client _client;
  final String? accountEmail;
  final String? token;
  RentalService({http.Client? client, this.accountEmail, this.token})
    : _client = client ?? http.Client();

  String _cacheKey(String kind) {
    final email = accountEmail?.trim().toLowerCase();
    if (email == null || email.isEmpty) {
      throw StateError('Sign in before accessing saved rentals.');
    }
    return 'rentwise_client_${kind}_${Uri.encodeComponent(email)}';
  }

  Future<String?> _getToken() async =>
      token ?? await TokenStore.instance.read();

  Future<Map<String, String>> _authHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> bankDetails(String agreementId) async {
    final response = await _client
        .get(
          Uri.parse(
            '${ApiConstants.baseUrl}/bank-details/agreements/$agreementId',
          ),
          headers: await _authHeaders(),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception('Could not load owner bank details.');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ──────────────────────────────────────────────
  // Local SharedPreferences Storage Helpers
  // ──────────────────────────────────────────────

  Future<void> saveLocalAgreement(AgreementModel agreement) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey('agreements'));
    List<dynamic> list = [];
    if (raw != null && raw.isNotEmpty) {
      try {
        list = jsonDecode(raw);
      } catch (_) {}
    }
    final index = list.indexWhere(
      (item) => item is Map && item['id']?.toString() == agreement.id,
    );
    if (index >= 0) {
      list[index] = agreement.toJson();
    } else {
      list.insert(0, agreement.toJson());
    }
    await prefs.setString(_cacheKey('agreements'), jsonEncode(list));
  }

  Future<void> saveLocalPayment(PaymentModel payment) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey('payments'));
    List<dynamic> list = [];
    if (raw != null && raw.isNotEmpty) {
      try {
        list = jsonDecode(raw);
      } catch (_) {}
    }
    list.insert(0, payment.toJson());
    await prefs.setString(_cacheKey('payments'), jsonEncode(list));
  }

  // ──────────────────────────────────────────────
  // Agreements
  // ──────────────────────────────────────────────

  /// Fetch all agreements for current user (merges API, local storage & accepted bookings)
  Future<List<AgreementModel>> fetchAgreements() async {
    final headers = await _authHeaders();
    final List<AgreementModel> remoteAgreements = [];

    // 1. Fetch from /agreements/mine
    try {
      final res = await _client
          .get(
            Uri.parse('${ApiConstants.baseUrl}/agreements/mine'),
            headers: headers,
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body);
        if (list is List) {
          remoteAgreements.addAll(
            list.map((j) => AgreementModel.fromJson(j as Map<String, dynamic>)),
          );
        }
      }
    } catch (_) {}

    // 2. Load local saved agreements from SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final localRaw = prefs.getString(_cacheKey('agreements'));
    final List<AgreementModel> localAgreements = [];
    if (localRaw != null && localRaw.isNotEmpty) {
      try {
        final List list = jsonDecode(localRaw);
        for (final item in list) {
          if (item is Map<String, dynamic>) {
            localAgreements.add(AgreementModel.fromJson(item));
          }
        }
      } catch (_) {}
    }

    // 3. Merge remote and local agreements
    final Map<String, AgreementModel> mergedMap = {};
    for (final a in remoteAgreements) {
      mergedMap[a.id] = a;
    }
    for (final a in localAgreements) {
      final existing = mergedMap[a.id];
      if (existing == null) {
        mergedMap[a.id] = a;
      } else {
        final mergedTerms =
            a.termsAndConditions.length >= existing.termsAndConditions.length
            ? a.termsAndConditions
            : existing.termsAndConditions;
        final mergedStatus = existing.status;
        final mergedPayments = [...existing.payments, ...a.payments];
        final pMap = <String, PaymentModel>{};
        for (final p in mergedPayments) {
          pMap[p.paymentReference.isNotEmpty ? p.paymentReference : p.id] = p;
        }

        mergedMap[a.id] = AgreementModel.fromJson({
          ...a.toJson(),
          ...existing.toJson(),
          'status': mergedStatus,
          'termsAndConditions': mergedTerms,
          'payments': pMap.values.map((p) => p.toJson()).toList(),
        });
      }
    }

    // 4. Auto-generate agreements for accepted property applications/bookings
    try {
      final appRes = await _client
          .get(
            Uri.parse('${ApiConstants.baseUrl}/property-applications'),
            headers: headers,
          )
          .timeout(const Duration(seconds: 8));
      if (appRes.statusCode == 200) {
        final appList = jsonDecode(appRes.body);
        if (appList is List) {
          for (final app in appList) {
            if (app is Map<String, dynamic>) {
              final status = app['status']?.toString() ?? '';
              if (status == 'Accepted' || status == 'Approved') {
                final propId = app['propertyId']?.toString() ?? '';
                final appId = app['id']?.toString() ?? '';
                final exists = mergedMap.values.any(
                  (a) =>
                      a.id == 'agr_$appId' ||
                      (propId.isNotEmpty && a.propertyId == propId),
                );
                if (!exists) {
                  num toNum(dynamic v) =>
                      num.tryParse(v?.toString() ?? '') ?? 0;
                  final rent = toNum(
                    app['monthlyRent'] ?? app['rentAmount'] ?? 65000,
                  ).toDouble();
                  final newAg = AgreementModel.fromJson({
                    'id': 'agr_$appId',
                    'propertyId': propId,
                    'ownerId': app['ownerId']?.toString() ?? '',
                    'tenantId': app['tenantId']?.toString() ?? '',
                    'agreedMonthlyRent': rent > 0 ? rent : 65000.0,
                    'securityDeposit': (rent > 0 ? rent : 65000.0) * 2,
                    'startDate': DateTime.now().toIso8601String().split('T')[0],
                    'endDate': DateTime.now()
                        .add(const Duration(days: 180))
                        .toIso8601String()
                        .split('T')[0],
                    'status': 'Drafted',
                    'termsAndConditions':
                        '[6-Month Lease Sent to Tenant on ${DateTime.now().toLocal().toString().split(' ')[0]}]\nPlease review house photos and terms, then click Review & Agree to proceed to payment.',
                    'property': {
                      'title':
                          app['propertyTitle'] ??
                          app['title'] ??
                          'Rental Property',
                      'address':
                          app['propertyAddress'] ??
                          app['address'] ??
                          'Sri Lanka',
                      'photoUrl': app['propertyPhoto'] ?? app['photoUrl'] ?? '',
                      'bedrooms': app['bedrooms'],
                      'propertyType': app['propertyType'] ?? 'Apartment',
                    },
                  });
                  mergedMap[newAg.id] = newAg;
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    // 5. Fetch payments for each non-mock agreement
    for (final id in mergedMap.keys) {
      if (id.startsWith('agr_')) continue;
      try {
        final res = await _client
            .get(
              Uri.parse('${ApiConstants.baseUrl}/agreements/$id/payments'),
              headers: headers,
            )
            .timeout(const Duration(seconds: 6));
        if (res.statusCode == 200) {
          final list = jsonDecode(res.body);
          if (list is List) {
            final ag = mergedMap[id]!;
            final pList = list
                .map((j) => PaymentModel.fromJson(j as Map<String, dynamic>))
                .toList();
            final pMap = <String, PaymentModel>{};
            for (final p in [...ag.payments, ...pList]) {
              pMap[p.paymentReference.isNotEmpty ? p.paymentReference : p.id] =
                  p;
            }
            mergedMap[id] = AgreementModel.fromJson({
              ...ag.toJson(),
              'payments': pMap.values.map((p) => p.toJson()).toList(),
            });
          }
        }
      } catch (_) {}
    }

    // 6. Load local payments from SharedPreferences
    final localPayRaw = prefs.getString(_cacheKey('payments'));
    if (localPayRaw != null && localPayRaw.isNotEmpty) {
      try {
        final List pList = jsonDecode(localPayRaw);
        for (final item in pList) {
          if (item is Map<String, dynamic>) {
            final p = PaymentModel.fromJson(item);
            if (mergedMap.containsKey(p.agreementId)) {
              final ag = mergedMap[p.agreementId]!;
              if (!ag.payments.any(
                (existingP) =>
                    existingP.id == p.id ||
                    existingP.paymentReference == p.paymentReference,
              )) {
                mergedMap[p.agreementId] = AgreementModel.fromJson({
                  ...ag.toJson(),
                  'payments': [
                    ...ag.payments.map((e) => e.toJson()),
                    p.toJson(),
                  ],
                });
              }
            }
          }
        }
      } catch (_) {}
    }

    final resultList = mergedMap.values.toList();
    resultList.sort((a, b) => b.id.compareTo(a.id));

    // Cache merged result
    try {
      await prefs.setString(
        _cacheKey('agreements'),
        jsonEncode(resultList.map((a) => a.toJson()).toList()),
      );
    } catch (_) {}

    return resultList;
  }

  /// Persist a booking-derived draft before calling endpoints that require a UUID.
  Future<AgreementModel> persistDraft(AgreementModel agreement) async {
    if (!agreement.id.startsWith('agr_')) return agreement;
    if (agreement.propertyId.isEmpty) {
      throw StateError('This booking is missing its property.');
    }
    final response = await _client
        .post(
          Uri.parse('${ApiConstants.baseUrl}/agreements'),
          headers: await _authHeaders(),
          body: jsonEncode({
            'propertyId': agreement.propertyId,
            if (agreement.ownerId.isNotEmpty) 'ownerId': agreement.ownerId,
            if (agreement.tenantId.isNotEmpty) 'tenantId': agreement.tenantId,
            'agreedMonthlyRent': agreement.agreedMonthlyRent,
            'securityDeposit': agreement.securityDeposit,
            'startDate': agreement.startDate,
            'endDate': agreement.endDate,
            'termsAndConditions': agreement.termsAndConditions,
          }),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw StateError('Could not save this lease.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final saved = AgreementModel.fromJson({
      ...agreement.toJson(),
      ...data,
      'property': data['property'] ?? agreement.property,
      'owner': data['owner'] ?? agreement.owner,
      'tenant': data['tenant'] ?? agreement.tenant,
    });
    if (saved.id.isEmpty || saved.id.startsWith('agr_')) {
      throw StateError('The server did not return a saved lease ID.');
    }
    await saveLocalAgreement(saved);
    final prefs = await SharedPreferences.getInstance();
    final list =
        jsonDecode(prefs.getString(_cacheKey('agreements')) ?? '[]') as List;
    list.removeWhere((item) => item is Map && item['id'] == agreement.id);
    await prefs.setString(_cacheKey('agreements'), jsonEncode(list));
    return saved;
  }

  /// Tenant agrees to the agreement
  Future<bool> agreeToAgreement(
    String id,
    String signatureName, {
    AgreementModel? localAgreement,
  }) async {
    final headers = await _authHeaders();
    bool success = false;
    try {
      final res = await _client
          .put(
            Uri.parse('${ApiConstants.baseUrl}/agreements/$id/agree'),
            headers: headers,
            body: jsonEncode({'signatureName': signatureName}),
          )
          .timeout(const Duration(seconds: 15));
      success = res.statusCode == 200 || res.statusCode == 204;
    } catch (_) {}

    if (!success) return false;

    if (localAgreement != null) {
      final now = DateTime.now().toUtc().toIso8601String();
      final tag = '[TENANT_AGREED: $now | Signer: $signatureName]';
      final updatedTerms =
          localAgreement.termsAndConditions.contains('[TENANT_AGREED')
          ? localAgreement.termsAndConditions
          : '${localAgreement.termsAndConditions}\n$tag';

      final updated = AgreementModel.fromJson({
        ...localAgreement.toJson(),
        'status': 'PendingOwnerApproval',
        'termsAndConditions': updatedTerms,
      });
      await saveLocalAgreement(updated);
    }

    return success;
  }

  // ──────────────────────────────────────────────
  // Payments
  // ──────────────────────────────────────────────

  /// Submit payment for an agreement
  Future<bool> payAgreement(
    String agreementId,
    double amount,
    String method,
    String reference, {
    AgreementModel? localAgreement,
    bool isMonthlyRent = false,
  }) async {
    final headers = await _authHeaders();
    final body = jsonEncode({
      'amount': amount,
      'isSuccessful': true,
      'paymentDate': DateTime.now().toUtc().toIso8601String(),
      'paymentMethod': method,
      'paymentReference': reference,
    });
    bool success = false;
    Map<String, dynamic>? savedPayment;

    try {
      final res = await _client
          .post(
            Uri.parse(
              '${ApiConstants.baseUrl}/agreements/$agreementId/${isMonthlyRent ? 'payments' : 'pay'}',
            ),
            headers: headers,
            body: body,
          )
          .timeout(const Duration(seconds: 15));
      success = res.statusCode == 200 || res.statusCode == 201;
      if (success) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        savedPayment = isMonthlyRent
            ? data
            : data['payment'] as Map<String, dynamic>?;
        success = savedPayment?['id']?.toString().isNotEmpty == true;
      }
    } catch (_) {
      success = false;
    }

    if (!success) return false;

    final payment = PaymentModel(
      id: savedPayment?['id']?.toString() ?? reference,
      purpose:
          savedPayment?['purpose']?.toString() ??
          (isMonthlyRent ? 'MonthlyRent' : 'SecurityDeposit'),
      agreementId: agreementId,
      amount: amount,
      paymentMethod: method,
      paymentReference: reference,
      isSuccessful: true,
      paidAt: DateTime.now().toUtc().toIso8601String(),
    );
    await saveLocalPayment(payment);

    if (localAgreement != null) {
      final now = DateTime.now().toUtc().toIso8601String();
      final tag =
          '[PAYMENT_SUCCESS: LKR ${amount.toStringAsFixed(2)} | Ref: $reference | Paid on: $now | Method: $method]';
      final updatedTerms =
          localAgreement.termsAndConditions.contains('[PAYMENT_SUCCESS')
          ? localAgreement.termsAndConditions
          : '${localAgreement.termsAndConditions}\n$tag';

      final updatedPayments = [...localAgreement.payments, payment];

      final updated = AgreementModel.fromJson({
        ...localAgreement.toJson(),
        'status': 'Active',
        'termsAndConditions': updatedTerms,
        'payments': updatedPayments.map((p) => p.toJson()).toList(),
      });
      await saveLocalAgreement(updated);
    }

    return success;
  }

  // ──────────────────────────────────────────────
  // Agentic AI – Agreement & Pricing Agent
  // ──────────────────────────────────────────────

  /// Calls ASP.NET Core, which invokes the internal AI service.
  /// Returns parsed JSON map on success, or null if the API cannot complete the audit.
  Future<Map<String, dynamic>?> auditAgreementWithAi({
    required String propertyId,
    required String agreementId,
    required double rent,
    required String location,
    required String propertyType,
    required int bedrooms,
    required String document,
  }) async {
    final payload = jsonEncode({
      'objective':
          'Review pricing using these supplied lease details: rent LKR $rent, location $location, type $propertyType, bedrooms $bedrooms. Terms: $document. Do not invent missing terms.',
      'property_id': propertyId,
      'agreement_id': agreementId,
      'rent': rent,
      'location': location,
      'property_type': propertyType,
      'bedrooms': bedrooms,
      'document': document,
    });

    try {
      final res = await _client
          .post(
            Uri.parse(
              '${ApiConstants.baseUrl}/agentic/workflow/draft-agreement',
            ),
            headers: await _authHeaders(),
            body: payload,
          )
          .timeout(const Duration(seconds: 120));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map) {
          var result = data['analysis'] ?? data['draft'];
          if (result is String) result = jsonDecode(result);
          if (result is Map<String, dynamic> &&
              result['error'] == null &&
              (result['market_pricing_assessment'] is Map ||
                  result['plain_language_summary'] is Map)) {
            return result;
          }
        }
      }
    } catch (_) {
      // The caller offers a clearly labelled local estimate and retry.
    }
    return null;
  }

  /// Client-side AI fallback: market pricing engine
  Map<String, dynamic> localAiAudit({
    required double rent,
    required String location,
    required String propertyType,
    required int bedrooms,
    required String ownerName,
    required String tenantName,
    required String propertyAddress,
    required String startDate,
    required String endDate,
    double? securityDeposit,
  }) {
    double median = 60000;
    double rMin = 48000;
    double rMax = 72000;
    final loc = location.toLowerCase();

    if (loc.contains('colombo 07')) {
      median = 110000;
      rMin = 85000;
      rMax = 140000;
    } else if (loc.contains('colombo 03')) {
      median = 105000;
      rMin = 80000;
      rMax = 135000;
    } else if (loc.contains('battaramulla')) {
      median = 90000;
      rMin = 75000;
      rMax = 115000;
    } else if (loc.contains('pelawatte')) {
      median = 85000;
      rMin = 70000;
      rMax = 105000;
    } else if (loc.contains('colombo')) {
      median = 95000;
      rMin = 70000;
      rMax = 125000;
    } else if (loc.contains('dehiwala')) {
      median = 52000;
      rMin = 42000;
      rMax = 65000;
    } else if (loc.contains('kandy')) {
      median = 48000;
      rMin = 38000;
      rMax = 60000;
    } else if (loc.contains('malabe')) {
      median = 58000;
      rMin = 48000;
      rMax = 68000;
    }

    String status;
    String varStr;
    String reasoning;

    if (rent > rMax) {
      final diff = ((rent - median) / median * 100).round();
      status = 'Above Typical Market Range';
      varStr = '+$diff%';
      reasoning =
          'Proposed rent of LKR ${_fmt(rent)} is approximately $varStr above standard market benchmarks for $bedrooms-bed $propertyType in $location.';
    } else if (rent < rMin) {
      final diff = ((median - rent) / median * 100).round();
      status = 'Below Typical Market Range';
      varStr = '-$diff%';
      reasoning =
          'Proposed rent of LKR ${_fmt(rent)} is $varStr below market average, representing competitive value for $location.';
    } else {
      final diff = ((rent - median) / median * 100).round();
      varStr = diff >= 0 ? '+$diff%' : '$diff%';
      status = 'Fair / Within Market Range';
      reasoning =
          'Proposed rent of LKR ${_fmt(rent)} is within typical market benchmark range (LKR ${_fmt(rMin)} – LKR ${_fmt(rMax)}) for $location.';
    }

    return {
      'is_local_estimate': true,
      'plain_language_summary': {
        'parties': 'Landlord: $ownerName | Tenant: $tenantName',
        'property_summary':
            '$bedrooms-Bedroom $propertyType located at $propertyAddress',
        'financial_terms':
            'Monthly Rent: LKR ${_fmt(rent)} | Security Deposit: LKR ${_fmt(securityDeposit ?? rent * 2)}',
        'lease_duration': '$startDate to $endDate',
        'terms': 'Refer to the signed agreement for maintenance, restrictions and termination terms.',
      },
      'market_pricing_assessment': {
        'listed_rent': rent,
        'typical_market_range': 'LKR ${_fmt(rMin)} – LKR ${_fmt(rMax)}',
        'median_benchmark': median,
        'market_status': status,
        'variance_percentage': varStr,
        'pricing_reasoning': reasoning,
      },
      'non_binding_disclaimer': 'Live AI is unavailable. This is a local estimate using preset benchmarks, not a live market assessment. Refer to your agreement for binding terms.',
    };
  }

  String _fmt(double v) => v
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
}
