import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../shared/theme/app_theme.dart';
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../home/providers/property_provider.dart';
import '../providers/maintenance_provider.dart';

class CreateMaintenanceScreen extends ConsumerStatefulWidget {
  const CreateMaintenanceScreen({super.key});

  @override
  ConsumerState<CreateMaintenanceScreen> createState() => _CreateMaintenanceScreenState();
}

class _CreateMaintenanceScreenState extends ConsumerState<CreateMaintenanceScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedPropertyId;
  String _description = '';
  bool _isLoading = false;

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate() || _selectedPropertyId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }
    _formKey.currentState!.save();

    setState(() => _isLoading = true);

    final authState = ref.read(authStateProvider);
    final token = authState.value?.token;

    try {
      final response = await http.post(
        Uri.parse('${ApiConstants.baseUrl}/maintenance-requests'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'propertyId': _selectedPropertyId,
          'description': _description,
          'photoUrl': '', // Optional for now
          'status': 'Reported',
          'aiCategory': 'General',
          'aiPriority': 'Normal'
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        ref.refresh(maintenanceProvider.future);
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Maintenance request submitted successfully!')));
        }
      } else {
        throw Exception('Failed to create request: ${response.body}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final propertiesAsync = ref.watch(propertiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Request', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
      ),
      body: propertiesAsync.when(
        data: (properties) {
          if (properties.isEmpty) {
            return const Center(child: Text('No properties available to report maintenance for.'));
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select Property', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _selectedPropertyId,
                    decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    items: properties.map((prop) {
                      return DropdownMenuItem(
                        value: prop.id,
                        child: Text(prop.title, overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedPropertyId = val),
                    validator: (val) => val == null ? 'Please select a property' : null,
                  ),
                  const SizedBox(height: 24),
                  const Text('Issue Description', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink)),
                  const SizedBox(height: 8),
                  TextFormField(
                    maxLines: 5,
                    decoration: InputDecoration(
                      hintText: 'Describe the issue in detail...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (val) => val == null || val.isEmpty ? 'Description cannot be empty' : null,
                    onSaved: (val) => _description = val ?? '',
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _submitRequest,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.teal,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Submit Request', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error loading properties: $err')),
      ),
    );
  }
}
