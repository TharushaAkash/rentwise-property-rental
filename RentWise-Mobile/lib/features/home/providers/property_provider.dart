import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/property_model.dart';

// Curated sample rentals matching FindRentals.jsx in Web Frontend
final List<PropertyModel> _defaultSampleRentals = [
  PropertyModel.fromJson({
    'id': 'sample-rental-1',
    'title': 'Modern Sunset Glass Villa',
    'description':
        'Stunning architectural villa with floor-to-ceiling glass, private garden and minimalist luxury aesthetics.',
    'address': '142 Lake Drive, Malabe',
    'city': 'Malabe',
    'monthlyRent': 65000,
    'bedrooms': 3,
    'bathrooms': 2,
    'sqft': 2200,
    'propertyType': 'Apartment',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Air Conditioning, Swimming Pool, Garden, Parking Space, 24/7 Security',
  }),
  PropertyModel.fromJson({
    'id': 'sample-rental-2',
    'title': 'Minimalist Two-Story White Residence',
    'description':
        'Clean geometric contemporary home featuring open-plan living, private plunge pool, and rooftop deck.',
    'address': '28 Orchard Way, Malabe',
    'city': 'Malabe',
    'monthlyRent': 55000,
    'bedrooms': 4,
    'bathrooms': 3,
    'sqft': 2600,
    'propertyType': 'House',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Swimming Pool, Solar Power, 2-Car Garage, Gym Access',
  }),
  PropertyModel.fromJson({
    'id': 'sample-rental-3',
    'title': 'Artisan Loft in Central Colombo',
    'description':
        'High-ceiling urban apartment filled with natural daylight, wooden floors and curated interior styling.',
    'address': '45 Ward Place, Colombo 07',
    'city': 'Colombo',
    'monthlyRent': 85000,
    'bedrooms': 2,
    'bathrooms': 2,
    'sqft': 1450,
    'propertyType': 'Apartment',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Furnished, Air Conditioned, Balcony, Elevator, 24/7 Security',
  }),
  PropertyModel.fromJson({
    'id': 'sample-rental-4',
    'title': 'Contemporary Garden Bungalow',
    'description':
        'Peaceful sanctuary surrounded by lush tropical greenery with modern fitted pantry and teak finishes.',
    'address': '88 Kandy Road, Pelawatte',
    'city': 'Pelawatte',
    'monthlyRent': 70000,
    'bedrooms': 3,
    'bathrooms': 2,
    'sqft': 1950,
    'propertyType': 'House',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Spacious Lawn, Servant Quarters, Hot Water, CCTV',
  }),
  PropertyModel.fromJson({
    'id': 'sample-rental-5',
    'title': 'Skyline View Penthouse Suite',
    'description':
        'Panoramic views over the ocean and skyline with wrap-around terrace and premium designer fittings.',
    'address': '12 Marine Drive, Colombo 03',
    'city': 'Colombo',
    'monthlyRent': 120000,
    'bedrooms': 3,
    'bathrooms': 3,
    'sqft': 2100,
    'propertyType': 'Apartment',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Sea View, Infinity Pool, Fitness Center, Backup Generator',
  }),
  PropertyModel.fromJson({
    'id': 'sample-rental-6',
    'title': 'Nordic Inspired Hillside Retreat',
    'description':
        'Bright and airy retreat with natural wood accents, scenic views, and high energy-efficient layout.',
    'address': '15 Peradeniya Road, Kandy',
    'city': 'Kandy',
    'monthlyRent': 48000,
    'bedrooms': 2,
    'bathrooms': 1,
    'sqft': 1300,
    'propertyType': 'Villa',
    'status': 'Active',
    'photoUrl':
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    'facilities': 'Mountain View, Garden Patio, Fully Furnished, Quiet Neighborhood',
  }),
];

final propertiesProvider = FutureProvider<List<PropertyModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  List<PropertyModel> apiProperties = [];

  if (token != null && token.isNotEmpty) {
    try {
      final response = await http.get(
        Uri.parse('${ApiConstants.baseUrl}/properties'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        apiProperties = data.map((e) => PropertyModel.fromJson(e)).toList();
      }
    } catch (_) {}
  }

  // Merge API properties with sample collection (matching FindRentals.jsx in web frontend)
  final Map<String, PropertyModel> map = {};
  for (final p in apiProperties) {
    map[p.id] = p;
  }
  for (final sample in _defaultSampleRentals) {
    if (!map.containsKey(sample.id)) {
      map[sample.id] = sample;
    }
  }

  return map.values.toList();
});

final bookedPropertiesProvider = FutureProvider<List<PropertyModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final token = authState.value?.token;

  if (token == null || token.isEmpty) {
    return [];
  }

  try {
    final response = await http.get(
      Uri.parse('${ApiConstants.baseUrl}/agreements/mine'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      final List<PropertyModel> properties = [];

      for (var agreement in data) {
        if (agreement['property'] != null) {
          properties.add(PropertyModel.fromJson(agreement['property']));
        }
      }

      final uniqueProperties = <String, PropertyModel>{};
      for (var prop in properties) {
        uniqueProperties[prop.id] = prop;
      }
      return uniqueProperties.values.toList();
    }
  } catch (_) {}

  return [];
});
