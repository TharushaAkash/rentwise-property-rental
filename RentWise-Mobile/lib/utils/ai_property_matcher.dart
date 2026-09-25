import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../features/home/models/property_model.dart';
import '../shared/utils/api_constants.dart';

class AiPropertyMatchResult {
  final dynamic property;
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

Future<AiSearchResult> matchPropertiesWithAi(String query, List<dynamic> properties) async {
  if (query.trim().isEmpty || properties.isEmpty) {
    return AiSearchResult([], '');
  }

  final q = query.toLowerCase().trim();
  
  // Budget extraction (needed for Agentic Service payload)
  double targetMaxBudget = 0;
  final budgetMatch = RegExp(r'(?:under|below|less than|max)\s*(?:lkr\s*|rs\.?\s*)?(\d+)(?:k|000)?', caseSensitive: false).firstMatch(q) ??
                      RegExp(r'(\d+)k', caseSensitive: false).firstMatch(q);
  if (budgetMatch != null) {
    double num = double.parse(budgetMatch.group(1)!);
    if (num < 1000) num = num * 1000;
    targetMaxBudget = num;
  }

  // 1. Try Calling Backend Agentic Service (Python Server)
  try {
    // Try 127.0.0.1 first (for Windows/iOS), fallback to 10.0.2.2 (for Android Emulator)
    // Also try the deployed Render URL if local agent isn't running.
    final urlsToTry = [
      'http://127.0.0.1:8000/workflow/match-location',
      'http://10.0.2.2:8000/workflow/match-location',
      'https://rentwise-ai-service.onrender.com/workflow/match-location'
    ];

    http.Response? response;
    
    for (String urlString in urlsToTry) {
      try {
        final url = Uri.parse(urlString);
        // Render free tier can take 50 seconds to wake up from sleep
        final timeoutSeconds = urlString.contains('onrender') ? 60 : 5;
        response = await http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'objective': query,
            'tenant_profile': {
              'name': 'Prospective Tenant',
              'role': 'Tenant',
              'preferredBudgetMax': targetMaxBudget > 0 ? targetMaxBudget : null
            }
          }),
        ).timeout(Duration(seconds: timeoutSeconds));
        
        if (response.statusCode == 200) {
          break; // Success!
        }
      } catch (_) {
        // Ignore and try next URL
      }
    }

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final returnedProperties = data['ranked_properties'] ?? data['matching_results'];
      
      if (returnedProperties != null && returnedProperties is List) {
        String destLandmark = data['destination_landmark'] ?? 'Target Area';
        List<AiPropertyMatchResult> backendMatches = [];

        for (var p in returnedProperties) {
          final propId = p['property_id'] ?? p['id'];
          // Find the matching original property model to ensure we have all local fields
          final matchExisting = properties.firstWhere(
            (ep) => ep.id.toString() == propId.toString(),
            orElse: () => null,
          );
          
          if (matchExisting != null) {
            backendMatches.add(AiPropertyMatchResult(
              property: matchExisting,
              matchScore: (p['match_score'] ?? 0).toInt(),
              distanceKm: (p['distance_km'] ?? 0).toDouble(),
              travelTimeMins: (p['travel_time_mins'] ?? 0).toInt(),
              matchReasons: (p['match_reasons'] as List?)?.map((e) => e.toString()).toList() ?? [],
              destinationLandmark: destLandmark,
            ));
          }
        }
        
        // Sort descending by score
        backendMatches.sort((a, b) => b.matchScore.compareTo(a.matchScore));
        return AiSearchResult(backendMatches, destLandmark);
      }
    }
  } catch (e) {
    print('Agentic AI backend note, executing client-side fallback: $e');
  }

  // 2. Resilient Client-Side Agent Engine (Fallback)
  
  // Extract destination
  String extractedDest = 'Target Area';
  String destKey = 'any';
  
  if (q.contains('jaffna')) {
    extractedDest = 'Jaffna'; destKey = 'jaffna';
  } else if (q.contains('galle')) {
    extractedDest = 'Galle'; destKey = 'galle';
  } else if (q.contains('kurunegala')) {
    extractedDest = 'Kurunegala'; destKey = 'kurunegala';
  } else if (q.contains('sliit') || q.contains('malabe')) {
    extractedDest = 'SLIIT Malabe'; destKey = 'malabe';
  } else if (q.contains('orion')) {
    extractedDest = 'Orion City IT Park'; destKey = 'orion';
  } else if (q.contains('colombo 07') || q.contains('ward place') || q.contains('cinnamon')) {
    extractedDest = 'Colombo 07'; destKey = 'colombo 07';
  } else if (q.contains('colombo 03') || q.contains('kollupitiya') || q.contains('marine')) {
    extractedDest = 'Colombo 03'; destKey = 'colombo 03';
  } else if (q.contains('colombo')) {
    extractedDest = 'Colombo'; destKey = 'colombo';
  } else if (q.contains('university') || q.contains('uoc')) {
    extractedDest = 'University of Colombo'; destKey = 'university';
  } else if (q.contains('battaramulla') || q.contains('thalangama')) {
    extractedDest = 'Battaramulla'; destKey = 'battaramulla';
  } else if (q.contains('pelawatte')) {
    extractedDest = 'Pelawatte'; destKey = 'pelawatte';
  } else if (q.contains('dehiwala') || q.contains('mount lavinia')) {
    extractedDest = 'Dehiwala'; destKey = 'dehiwala';
  } else if (q.contains('kandy') || q.contains('peradeniya')) {
    extractedDest = 'Kandy'; destKey = 'kandy';
  }

  // Budget extraction was moved to the top of the file

  // Bedroom extraction
  int targetBeds = 0;
  if (q.contains('1-bed') || q.contains('1 bed') || q.contains('single') || q.contains('studio')) targetBeds = 1;
  else if (q.contains('2-bed') || q.contains('2 bed')) targetBeds = 2;
  else if (q.contains('3-bed') || q.contains('3 bed')) targetBeds = 3;
  else if (q.contains('4-bed') || q.contains('4 bed')) targetBeds = 4;

  // Facilities extraction
  final wantsAC = q.contains('ac') || q.contains('air condition');
  final wantsParking = q.contains('park') || q.contains('garage');
  final wantsPool = q.contains('pool');
  final wantsFurnished = q.contains('furnish');
  final wantsGarden = q.contains('garden');

  List<AiPropertyMatchResult> scoredList = [];

  for (var prop in properties) {
    final title = (prop.title ?? '').toString().toLowerCase();
    final address = (prop.address ?? '').toString().toLowerCase();
    final description = (prop.description ?? '').toString().toLowerCase();
    
    // In our model we don't have facilities or city, we'll parse from description/address
    final propFacilities = description; 
    
    final rent = (prop.monthlyRent ?? 0).toDouble();
    final beds = (prop.bedrooms ?? 0).toInt();

    // Strict location filtering for fallback
    if (destKey != 'any' && destKey != 'colombo') {
      if (!address.contains(destKey) && !description.contains(destKey) && !title.contains(destKey)) {
        continue;
      }
    }

    double distanceKm = 3.5;
    int travelMins = 10;
    
    if (address.contains(destKey) || title.contains(destKey)) {
      distanceKm = 1.6;
      travelMins = 5;
    } else if (destKey == 'sliit' && (address.contains('malabe') || description.contains('malabe'))) {
      distanceKm = 1.8;
      travelMins = 6;
    } else if (destKey == 'sliit' && (address.contains('battaramulla') || address.contains('pelawatte'))) {
      distanceKm = 4.2;
      travelMins = 12;
    } else if (destKey == 'colombo 07' && (address.contains('colombo') || address.contains('ward'))) {
      distanceKm = 1.2;
      travelMins = 4;
    } else if (destKey == 'dehiwala' && (address.contains('dehiwala') || address.contains('marine'))) {
      distanceKm = 1.4;
      travelMins = 5;
    } else {
      distanceKm = 6.8;
      travelMins = 20;
    }

    int score = 70;
    List<String> reasons = [];

    // Budget evaluation (30 pts)
    if (targetMaxBudget > 0) {
      if (rent <= targetMaxBudget) {
        score += 15;
        reasons.add('Monthly rent of LKR ${rent.toStringAsFixed(0)} fits within your LKR ${targetMaxBudget.toStringAsFixed(0)} budget');
      } else if (rent <= targetMaxBudget * 1.1) {
        score += 8;
        reasons.add('Rent of LKR ${rent.toStringAsFixed(0)} is very close to your budget');
      } else {
        score -= 10;
      }
    } else {
      score += 10;
      reasons.add('Competitively priced at LKR ${rent.toStringAsFixed(0)} per month');
    }

    // Distance & Commute evaluation (30 pts)
    if (distanceKm <= 2.5) {
      score += 15;
      reasons.add('Excellent proximity: only ${distanceKm} km (~${travelMins} mins commute) to ${extractedDest}');
    } else if (distanceKm <= 5.0) {
      score += 8;
      reasons.add('Reasonable commute: ${distanceKm} km (~${travelMins} mins) to ${extractedDest}');
    } else {
      score -= 5;
    }

    // Bedroom evaluation (20 pts)
    if (targetBeds > 0) {
      if (beds == targetBeds) {
        score += 10;
        reasons.add('Exactly matches your ${targetBeds}-bedroom preference');
      } else if (beds > targetBeds) {
        score += 6;
        reasons.add('Offers ${beds} bedrooms (extra space for your needs)');
      } else {
        score -= 8;
      }
    } else {
      score += 5;
    }

    // Facility matches (20 pts)
    List<String> facilityMatches = [];
    if (wantsAC && (propFacilities.contains('air') || propFacilities.contains('ac'))) facilityMatches.add('Air Conditioning');
    if (wantsParking && (propFacilities.contains('park') || propFacilities.contains('garage'))) facilityMatches.add('Parking');
    if (wantsPool && propFacilities.contains('pool')) facilityMatches.add('Swimming Pool');
    if (wantsFurnished && propFacilities.contains('furnish')) facilityMatches.add('Furnished');
    if (wantsGarden && propFacilities.contains('garden')) facilityMatches.add('Garden');

    if (facilityMatches.isNotEmpty) {
      score += min(10, facilityMatches.length * 5);
      reasons.add('Equipped with requested \${facilityMatches.join(" and ")}');
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
