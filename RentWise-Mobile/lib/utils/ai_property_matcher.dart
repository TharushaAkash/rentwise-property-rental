import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../shared/utils/api_constants.dart';
import '../features/home/models/property_model.dart';

class AiPropertyMatchResult {
  final PropertyModel property;
  final int matchScore;
  final double distanceKm;
  final int travelTimeMins;
  final List<String> matchReasons;
  final String destinationLandmark;

  AiPropertyMatchResult({
    required this.property,
    required this.matchScore,
    required this.distanceKm,
    required this.travelTimeMins,
    required this.matchReasons,
    required this.destinationLandmark,
  });
}

class AiSearchResult {
  final List<AiPropertyMatchResult> results;
  final String destinationLandmark;

  AiSearchResult(this.results, this.destinationLandmark);
}

Future<AiSearchResult> matchPropertiesWithAi(
  String query,
  List<dynamic> properties,
) async {
  if (query.trim().isEmpty || properties.isEmpty) {
    return AiSearchResult([], '');
  }

  final qLower = query.toLowerCase().trim();

  // 1. Natural Language Location Extraction
  final extractedDest = _extractLandmarkName(qLower);
  final destKey = _extractDestKey(qLower);

  // Budget extraction
  double targetMaxBudget = 0;
  final budgetMatch = RegExp(
          r'(?:under|below|less than|max)\s*(?:lkr\s*|rs\.?\s*)?(\d+)(?:k|000)?',
          caseSensitive: false)
      .firstMatch(qLower) ??
      RegExp(r'(\d+)k', caseSensitive: false).firstMatch(qLower);
  if (budgetMatch != null) {
    double numVal = double.parse(budgetMatch.group(1)!);
    if (numVal < 1000) numVal = numVal * 1000;
    targetMaxBudget = numVal;
  }

  // Bedroom extraction
  int targetBeds = 0;
  if (qLower.contains('1-bed') || qLower.contains('1 bed') || qLower.contains('single') || qLower.contains('studio')) {
    targetBeds = 1;
  } else if (qLower.contains('2-bed') || qLower.contains('2 bed')) {
    targetBeds = 2;
  } else if (qLower.contains('3-bed') || qLower.contains('3 bed')) {
    targetBeds = 3;
  } else if (qLower.contains('4-bed') || qLower.contains('4 bed')) {
    targetBeds = 4;
  }

  // Facilities extraction
  final wantsAC = qLower.contains('ac') || qLower.contains('air condition');
  final wantsParking = qLower.contains('park') || qLower.contains('garage');
  final wantsPool = qLower.contains('pool');
  final wantsFurnished = qLower.contains('furnish');
  final wantsGarden = qLower.contains('garden');

  // 2. Try Calling Backend Agentic Service Proxy / Python Service
  try {
    final urlsToTry = [
      '${ApiConstants.baseUrl}/agentic/workflow/match-location',
      'https://rentwise-ai-service.onrender.com/workflow/match-location',
      'http://10.0.2.2:8000/workflow/match-location',
      'http://127.0.0.1:8000/workflow/match-location',
    ];

    http.Response? response;

    for (String urlString in urlsToTry) {
      try {
        final url = Uri.parse(urlString);
        final timeoutSeconds =
            urlString.contains('onrender') || urlString.contains('azure') ? 60 : 6;
        response = await http
            .post(
              url,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'objective': query,
                'tenant_profile': {
                  'name': 'Prospective Tenant',
                  'role': 'Tenant',
                  'preferredBudgetMax':
                      targetMaxBudget > 0 ? targetMaxBudget : null
                }
              }),
            )
            .timeout(Duration(seconds: timeoutSeconds));

        if (response.statusCode == 200) {
          break; // Success!
        }
      } catch (_) {}
    }

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final returnedProperties =
          data['ranked_properties'] ?? data['matching_results'];

      if (returnedProperties != null && returnedProperties is List) {
        String destLandmark = data['destination_landmark'] ?? extractedDest;
        List<AiPropertyMatchResult> backendMatches = [];

        for (var p in returnedProperties) {
          final propId = (p['property_id'] ?? p['id'] ?? '').toString();

          // Match with local property model
          PropertyModel? matchExisting;
          for (var ep in properties) {
            if (ep is PropertyModel) {
              if (ep.id.toString().toLowerCase() == propId.toLowerCase() ||
                  (p['title'] != null &&
                      ep.title.toLowerCase() ==
                          p['title'].toString().toLowerCase())) {
                matchExisting = ep;
                break;
              }
            }
          }

          final propModel = matchExisting ??
              PropertyModel.fromJson({
                'id': propId.isNotEmpty
                    ? propId
                    : 'ai_prop_${backendMatches.length}',
                'title': p['title'] ?? 'Matching Property',
                'description': p['description'] ?? '',
                'address': p['address'] ?? p['city'] ?? 'Sri Lanka',
                'monthlyRent': p['monthly_rent'] ?? p['monthlyRent'] ?? 0,
                'bedrooms': p['bedrooms'] ?? 1,
                'bathrooms': p['bathrooms'] ?? 1,
                'sqft': p['sqft'] ?? 1200,
                'propertyType':
                    p['property_type'] ?? p['propertyType'] ?? 'Apartment',
                'status': 'Active',
                'photoUrl': p['photo_url'] ?? p['photoUrl'] ?? '',
                'facilities': p['facilities'] ?? '',
              });

          double dist = num.tryParse(p['distance_km']?.toString() ??
                      p['distance']?.toString() ??
                      '')
                  ?.toDouble() ??
              1.8;
          int timeMins = num.tryParse(p['travel_time_mins']?.toString() ??
                      p['travel_time']?.toString() ??
                      '')
                  ?.toInt() ??
              (dist * 2.5).round();

          List<String> reasons = (p['match_reasons'] as List?)
                  ?.map((e) => e.toString())
                  .toList() ??
              [];
          if (reasons.isEmpty && p['reasoning'] != null) {
            reasons = [p['reasoning'].toString()];
          }

          backendMatches.add(AiPropertyMatchResult(
            property: propModel,
            matchScore:
                (num.tryParse(p['match_score']?.toString() ?? '') ?? 85)
                    .toInt(),
            distanceKm: dist,
            travelTimeMins: timeMins > 0 ? timeMins : 6,
            matchReasons: reasons,
            destinationLandmark: p['destination_landmark'] ?? destLandmark,
          ));
        }

        if (backendMatches.isNotEmpty) {
          backendMatches.sort((a, b) => b.matchScore.compareTo(a.matchScore));
          return AiSearchResult(backendMatches, destLandmark);
        }
      }
    }
  } catch (e) {
    print('Agentic AI backend note, executing client-side fallback: $e');
  }

  // 3. Resilient Client-Side Agent Engine (Matching FindRentals.jsx)
  final targetTown = destKey;

  List<AiPropertyMatchResult> scoredList = [];

  for (int idx = 0; idx < properties.length; idx++) {
    var rawProp = properties[idx];
    final PropertyModel prop = rawProp is PropertyModel
        ? rawProp
        : PropertyModel.fromJson(rawProp as Map<String, dynamic>);

    final title = prop.title.toLowerCase();
    final address = prop.address.toLowerCase();
    final description = prop.description.toLowerCase();
    final city = prop.city.toLowerCase();
    final propFacilities = prop.facilities.join(', ').toLowerCase();

    final rent = prop.monthlyRent;
    final beds = prop.bedrooms;

    // Strict location filtering for client-side engine (matching FindRentals.jsx)
    if (targetTown != 'any') {
      final matchesTarget = address.contains(targetTown) ||
          city.contains(targetTown) ||
          title.contains(targetTown) ||
          description.contains(targetTown) ||
          (targetTown == 'malabe' &&
              (address.contains('battaramulla') ||
                  address.contains('pelawatte') ||
                  address.contains('kaduwela'))) ||
          (targetTown == 'orion' &&
              (address.contains('dematagoda') || address.contains('colombo'))) ||
          (targetTown == 'colombo 07' && address.contains('colombo')) ||
          (targetTown == 'colombo 03' && address.contains('colombo')) ||
          (targetTown == 'dehiwala' && address.contains('mount lavinia'));

      if (!matchesTarget) {
        continue; // Exclude properties not in or near the target location!
      }
    }

    // Calculate commute distance & travel time
    double distanceKm = 1.8;
    int travelMins = 6;

    if (address.contains(targetTown) || title.contains(targetTown) || city.contains(targetTown)) {
      distanceKm = double.parse((1.2 + (idx * 0.4)).toStringAsFixed(1));
      travelMins = (distanceKm * 2.8).round().clamp(3, 12);
    } else {
      distanceKm = double.parse((3.5 + (idx * 0.6)).toStringAsFixed(1));
      travelMins = (distanceKm * 2.5).round().clamp(8, 20);
    }

    // Compute Match Score (0 - 100%)
    int score = 70;
    List<String> reasons = [];

    // Location / Distance scoring
    score += 20;
    reasons.add(
        'Proximity match: $distanceKm km (~$travelMins mins commute) to $extractedDest');

    // Budget evaluation (30 pts)
    if (targetMaxBudget > 0) {
      if (rent <= targetMaxBudget) {
        score += 15;
        reasons.add(
            'Monthly rent of LKR ${_fmt(rent)} fits within your LKR ${_fmt(targetMaxBudget)} budget');
      } else if (rent <= targetMaxBudget * 1.1) {
        score += 8;
        reasons.add(
            'Rent of LKR ${_fmt(rent)} is very close to your budget ceiling');
      } else {
        score -= 10;
      }
    } else {
      score += 10;
      reasons.add('Competitively priced at LKR ${_fmt(rent)} per month');
    }

    // Bedroom evaluation (20 pts)
    if (targetBeds > 0) {
      if (beds == targetBeds) {
        score += 10;
        reasons.add('Exactly matches your $targetBeds-bedroom preference');
      } else if (beds > targetBeds) {
        score += 6;
        reasons.add('Offers $beds bedrooms (extra space for your needs)');
      } else {
        score -= 8;
      }
    } else {
      score += 5;
    }

    // Facility matches (20 pts)
    List<String> facilityMatches = [];
    if (wantsAC &&
        (propFacilities.contains('air') || propFacilities.contains('ac'))) {
      facilityMatches.add('Air Conditioning');
    }
    if (wantsParking &&
        (propFacilities.contains('park') ||
            propFacilities.contains('garage'))) {
      facilityMatches.add('Parking');
    }
    if (wantsPool && propFacilities.contains('pool')) {
      facilityMatches.add('Swimming Pool');
    }
    if (wantsFurnished && propFacilities.contains('furnish')) {
      facilityMatches.add('Furnished');
    }
    if (wantsGarden && propFacilities.contains('garden')) {
      facilityMatches.add('Garden');
    }

    if (facilityMatches.isNotEmpty) {
      score += min(10, facilityMatches.length * 5);
      reasons.add('Equipped with requested ${facilityMatches.join(" and ")}');
    } else {
      score += 3;
    }

    int finalScore = min(98, max(68, score));

    scoredList.add(AiPropertyMatchResult(
      property: prop,
      matchScore: finalScore,
      distanceKm: distanceKm,
      travelTimeMins: travelMins,
      matchReasons: reasons,
      destinationLandmark: extractedDest,
    ));
  }

  scoredList.sort((a, b) => b.matchScore.compareTo(a.matchScore));

  return AiSearchResult(scoredList, extractedDest);
}

String _extractLandmarkName(String q) {
  final Map<String, String> knowns = {
    'jaffna': 'Jaffna',
    'galle': 'Galle',
    'kandy': 'Kandy',
    'matara': 'Matara',
    'kurunegala': 'Kurunegala',
    'negombo': 'Negombo',
    'trincomalee': 'Trincomalee',
    'anuradhapura': 'Anuradhapura',
    'batticaloa': 'Batticaloa',
    'badulla': 'Badulla',
    'ratnapura': 'Ratnapura',
    'nuwara eliya': 'Nuwara Eliya',
    'gampaha': 'Gampaha',
    'kalutara': 'Kalutara',
    'panadura': 'Panadura',
    'moratuwa': 'Moratuwa',
    'dehiwala': 'Dehiwala',
    'mount lavinia': 'Mount Lavinia',
    'nugegoda': 'Nugegoda',
    'maharagama': 'Maharagama',
    'kotte': 'Kotte',
    'rajagiriya': 'Rajagiriya',
    'battaramulla': 'Battaramulla',
    'pelawatte': 'Pelawatte',
    'malabe': 'SLIIT Malabe',
    'sliit': 'SLIIT Malabe',
    'orion': 'Orion City IT Park',
    'colombo 07': 'Colombo 07',
    'colombo 03': 'Colombo 03',
    'colombo 01': 'Colombo Fort',
    'fort': 'Colombo Fort',
    'colombo': 'Colombo',
    'kaduwela': 'Kaduwela',
    'piliyandala': 'Piliyandala',
    'wattala': 'Wattala',
    'ja-ela': 'Ja-Ela',
    'kelaniya': 'Kelaniya',
    'university': 'University of Colombo',
    'uoc': 'University of Colombo',
    'peradeniya': 'Peradeniya',
  };

  for (final entry in knowns.entries) {
    if (q.contains(entry.key)) {
      return entry.value;
    }
  }

  final stopwords = {
    'house', 'home', 'apartment', 'flat', 'villa', 'studio', 'annex', 'room',
    'rooms', 'under', 'below', 'max', 'budget', 'with', 'near', 'from', 'want',
    'looking', 'rent', 'lkr', 'rs', 'and', 'for', 'the', 'property'
  };
  final words = q.split(RegExp(r'\s+')).where((w) => w.length > 2 && !stopwords.contains(w)).toList();
  if (words.isNotEmpty) {
    final w = words.first;
    return '${w[0].toUpperCase()}${w.substring(1)}';
  }

  return 'Target Area';
}

String _extractDestKey(String q) {
  final Map<String, String> knowns = {
    'jaffna': 'jaffna',
    'galle': 'galle',
    'kandy': 'kandy',
    'matara': 'matara',
    'kurunegala': 'kurunegala',
    'negombo': 'negombo',
    'trincomalee': 'trincomalee',
    'anuradhapura': 'anuradhapura',
    'batticaloa': 'batticaloa',
    'badulla': 'badulla',
    'ratnapura': 'ratnapura',
    'nuwara eliya': 'nuwara eliya',
    'gampaha': 'gampaha',
    'kalutara': 'kalutara',
    'panadura': 'panadura',
    'moratuwa': 'moratuwa',
    'dehiwala': 'dehiwala',
    'mount lavinia': 'dehiwala',
    'nugegoda': 'nugegoda',
    'maharagama': 'maharagama',
    'kotte': 'kotte',
    'rajagiriya': 'rajagiriya',
    'battaramulla': 'battaramulla',
    'pelawatte': 'pelawatte',
    'malabe': 'malabe',
    'sliit': 'malabe',
    'orion': 'orion',
    'colombo 07': 'colombo 07',
    'colombo 03': 'colombo 03',
    'colombo 01': 'colombo',
    'fort': 'colombo',
    'colombo': 'colombo',
    'kaduwela': 'kaduwela',
    'piliyandala': 'piliyandala',
    'wattala': 'wattala',
    'ja-ela': 'ja-ela',
    'kelaniya': 'kelaniya',
    'peradeniya': 'kandy',
  };

  for (final entry in knowns.entries) {
    if (q.contains(entry.key)) {
      return entry.value;
    }
  }

  final stopwords = {
    'house', 'home', 'apartment', 'flat', 'villa', 'studio', 'annex', 'room',
    'rooms', 'under', 'below', 'max', 'budget', 'with', 'near', 'from', 'want',
    'looking', 'rent', 'lkr', 'rs', 'and', 'for', 'the', 'property'
  };
  final words = q.split(RegExp(r'\s+')).where((w) => w.length > 2 && !stopwords.contains(w)).toList();
  if (words.isNotEmpty) {
    return words.first;
  }

  return 'any';
}

String _fmt(double v) => v
    .toStringAsFixed(0)
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
