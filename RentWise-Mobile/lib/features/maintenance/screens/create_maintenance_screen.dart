import '../../shared/widgets/modern_ui.dart';

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../shared/theme/app_theme.dart';
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../home/providers/property_provider.dart';
import '../providers/maintenance_provider.dart';

import 'dart:async';

class CreateMaintenanceScreen extends ConsumerStatefulWidget {
  const CreateMaintenanceScreen({super.key});

  @override
  ConsumerState<CreateMaintenanceScreen> createState() =>
      _CreateMaintenanceScreenState();
}

class _CreateMaintenanceScreenState
    extends ConsumerState<CreateMaintenanceScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedPropertyId;
  String _description = '';
  String _category = 'General';
  String _priority = 'Medium';
  bool _isLoading = false;
  Timer? _debounceTimer;
  String? _assignedProviderId;
  String? _assignedProviderName;

  final List<String> _categories = [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Appliance',
    'Structural',
    'Pest',
    'General',
  ];
  final List<Map<String, dynamic>> _priorities = [
    {'label': 'Low', 'value': 'Low', 'color': Colors.blueGrey},
    {'label': 'Medium', 'value': 'Medium', 'color': Colors.orange},
    {'label': 'High', 'value': 'High', 'color': Colors.red},
    {'label': 'Emergency', 'value': 'Emergency', 'color': Colors.redAccent},
  ];

  Future<void> _runAiTriage(String text, {bool showToast = false}) async {
    if (text.isEmpty) return;

    String cat = 'General';
    String prio = 'Medium';

    final lowerDesc = text.toLowerCase();
    if ([
      'pipe',
      'water',
      'leak',
      'plumbing',
      'flood',
      'faucet',
      'sink',
      'toilet',
      'drain',
      'burst',
    ].any((w) => lowerDesc.contains(w))) {
      cat = 'Plumbing';
      prio = (lowerDesc.contains('flood') || lowerDesc.contains('burst'))
          ? 'Emergency'
          : 'High';
    } else if ([
      'power',
      'light',
      'electric',
      'wire',
      'socket',
    ].any((w) => lowerDesc.contains(w))) {
      cat = 'Electrical';
      prio = 'High';
    } else if ([
      'ac',
      'heater',
      'cool',
      'air',
      'fan',
    ].any((w) => lowerDesc.contains(w))) {
      cat = 'HVAC';
      prio = 'Medium';
    }

    String? assignedId;
    String? assignedName;

    try {
      final authState = ref.read(authStateProvider);
      final token = authState.value?.token;

      final res = await http.get(
        Uri.parse('${ApiConstants.baseUrl}/service-providers'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final List<dynamic> providers = jsonDecode(res.body);
        final matches = providers
            .where(
              (p) => p['category'].toString().toLowerCase().contains(
                cat.toLowerCase(),
              ),
            )
            .toList();
        if (matches.isNotEmpty) {
          assignedId = matches[0]['id'];
          assignedName = matches[0]['name'];
        }
      }
    } catch (e) {
      debugPrint('Failed to fetch providers: $e');
    }

    if (mounted) {
      setState(() {
        _category = cat;
        _priority = prio;
        _assignedProviderId = assignedId;
        _assignedProviderName = assignedName;
      });
      if (showToast) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'AI Triage: $cat - $prio\n${assignedName != null ? 'Provider: $assignedName' : 'No provider found'}',
            ),
          ),
        );
      }
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate() || _selectedPropertyId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please select a property and fill all required fields',
          ),
        ),
      );
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
          'status': _assignedProviderId != null ? 'Assigned' : 'Reported',
          'aiCategory': _category,
          'aiPriority': _priority,
          'assignedServiceProviderId': _assignedProviderId,
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        ref.invalidate(maintenanceProvider);
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Maintenance request submitted successfully!'),
            ),
          );
        }
      } else {
        throw Exception('Failed to create request: ${response.body}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final propertiesAsync = ref.watch(bookedPropertiesProvider);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Text(
          'New Maintenance Request',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.canvas,
        scrolledUnderElevation: 0,
      ),
      body: propertiesAsync.when(
        data: (properties) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const PageIntro(
                    eyebrow: 'Care for your home',
                    title: 'Let?s get it fixed.',
                    description: 'Tell us what needs attention. Add a few details so your owner can help.',
                    icon: Icons.handyman_outlined,
                  ),
                  const SizedBox(height: 28),
                  // 1. Property Context
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Text(
                        'TARGET PROPERTY',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.muted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      if (_selectedPropertyId != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.check_circle_rounded,
                              size: 14,
                              color: AppColors.teal,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Booked Home',
                              style: TextStyle(
                                color: AppColors.teal,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (properties.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.orange[200]!),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.info_outline,
                            size: 16,
                            color: Colors.orange[800],
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              "You don't have an active booked property yet. Please book a property first to request maintenance.",
                              style: TextStyle(
                                color: Colors.orange[800],
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _selectedPropertyId,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.line),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        hintText: 'Choose your booked property',
                        hintMaxLines: 2,
                      ),
                      items: properties.map((prop) {
                        return DropdownMenuItem(
                          value: prop.id,
                          child: Text(
                            prop.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) =>
                          setState(() => _selectedPropertyId = val),
                      validator: (val) =>
                          val == null ? 'Please select a property' : null,
                    ),

                  const SizedBox(height: 24),

                  // 2. Category & Priority
                  // 2. Category & Priority
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 12,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              const Text(
                                'CATEGORY',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.muted,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.auto_awesome,
                                    size: 12,
                                    color: AppColors.teal,
                                  ),
                                  const SizedBox(width: 2),
                                  Text(
                                    'Network',
                                    style: TextStyle(
                                      color: AppColors.teal,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<String>(
                            isExpanded: true,
                            initialValue: _category,
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                  color: AppColors.line,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                  color: AppColors.line,
                                ),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                            ),
                            items: _categories
                                .map(
                                  (c) => DropdownMenuItem(
                                    value: c,
                                    child: Text(
                                      c,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (val) =>
                                setState(() => _category = val!),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Priority
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'URGENCY / PRIORITY',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.muted,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _priorities.map((p) {
                              final isSelected = _priority == p['value'];
                              return GestureDetector(
                                onTap: () =>
                                    setState(() => _priority = p['value']),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? p['color']
                                        : Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: isSelected
                                          ? p['color']
                                          : AppColors.line,
                                    ),
                                    boxShadow: isSelected
                                        ? [
                                            BoxShadow(
                                              color: p['color'].withValues(
                                                alpha: 0.3,
                                              ),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ]
                                        : [],
                                  ),
                                  child: Text(
                                    p['label'],
                                    style: TextStyle(
                                      color: isSelected
                                          ? Colors.white
                                          : AppColors.muted,
                                      fontWeight: isSelected
                                          ? FontWeight.w700
                                          : FontWeight.w600,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Provider suggestion
                  if (_assignedProviderName != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.blue[200]!),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.handyman_rounded,
                            color: Colors.blue[700],
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'AI Suggested Provider',
                                  style: TextStyle(
                                    color: Colors.blue[700],
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  _assignedProviderName!,
                                  style: TextStyle(
                                    color: Colors.blue[900],
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.blue[200]!),
                            ),
                            child: Text(
                              'Auto-Assigned',
                              style: TextStyle(
                                color: Colors.blue[700],
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // 3. Issue Description
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Text.rich(
                        TextSpan(
                          text: 'ISSUE DESCRIPTION ',
                          children: [
                            TextSpan(text: '*', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.muted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          if (_description.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Please enter a description first',
                                ),
                              ),
                            );
                            return;
                          }
                          _runAiTriage(_description, showToast: true);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.teal,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.teal.withValues(alpha: 0.3),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_awesome,
                                size: 12,
                                color: Colors.white,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'AI Triage',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    maxLines: 5,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      hintText: 'Describe the issue in detail...',
                      hintStyle: const TextStyle(color: AppColors.muted),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                    ),
                    validator: (val) => val == null || val.isEmpty
                        ? 'Description cannot be empty'
                        : null,
                    onSaved: (val) => _description = val ?? '',
                    onChanged: (val) {
                      _description = val;
                      if (_debounceTimer?.isActive ?? false) {
                        _debounceTimer!.cancel();
                      }
                      if (val.trim().length > 8) {
                        _debounceTimer = Timer(
                          const Duration(milliseconds: 700),
                          () {
                            _runAiTriage(val);
                          },
                        );
                      }
                    },
                  ),

                  const SizedBox(height: 32),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _submitRequest,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.teal,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text(
                              'Submit Request',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) =>
            Center(child: Text('Error loading properties: $err')),
      ),
    );
  }
}
