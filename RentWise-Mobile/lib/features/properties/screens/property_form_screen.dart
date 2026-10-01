import '../../../shared/validation/input_validators.dart';
import '../../shared/widgets/modern_ui.dart';

import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../home/models/property_model.dart';
import '../../home/providers/property_provider.dart';
import '../property_service.dart';

const propertyTypes = [
  'House',
  'Apartment',
  'Villa',
  'Bungalow',
  'Studio',
  'Commercial',
  'Annex',
];
const suggestedTags = [
  'Luxury',
  'Furnished',
  'Semi-Furnished',
  'Unfurnished',
  'Sea View',
  'Garden',
  'Swimming Pool',
  'Gym Access',
  'Parking Space',
  'Newly Built',
  'Air Conditioned',
  'Pet Friendly',
  '24/7 Security',
];
const samplePhotos = {
  'Modern Exterior': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'Living Room': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'Master Bedroom': 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
  'Kitchen & Dining': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
};

class PropertyFormScreen extends ConsumerStatefulWidget {
  const PropertyFormScreen({super.key, this.property});
  final PropertyModel? property;
  @override
  ConsumerState<PropertyFormScreen> createState() => _PropertyFormScreenState();
}

class _PropertyFormScreenState extends ConsumerState<PropertyFormScreen> {
  final _form = GlobalKey<FormState>();
  final _fields = <String, TextEditingController>{};
  final _tag = TextEditingController(),
      _url = TextEditingController(),
      _billUrl = TextEditingController();
  final _photos = <({String name, Uint8List bytes})>[];
  final _urls = <String>[];
  final _tags = <String>{};
  ({String name, Uint8List bytes})? _bill;
  String _type = 'House', _status = 'PendingVerification';
  String? _savedId, _error;
  bool _busy = false;
  int _uploadedPhotoCount = 0;
  @override
  void initState() {
    super.initState();
    final p = widget.property;
    final values = {
      'title': p?.title ?? '',
      'description': p?.description ?? '',
      'address': p?.address ?? '',
      'monthlyRent': p?.monthlyRent.toString() ?? '',
      'bedrooms': '${p?.bedrooms ?? 1}',
      'bathrooms': '${p?.bathrooms ?? 1}',
      'sqft': '${p?.sqft ?? 1200}',
      'facilities': p?.facilities.join(', ') ?? '',
    };
    for (final e in values.entries) {
      _fields[e.key] = TextEditingController(text: e.value);
    }
    _type = propertyTypes.contains(p?.propertyType) ? p!.propertyType : 'House';
    _status = p?.status ?? 'PendingVerification';
    _tags.addAll(p?.featureTags ?? []);
    _savedId = p?.id;
    _uploadedPhotoCount = p?.photos.length ?? 0;
  }

  @override
  void dispose() {
    for (final c in [..._fields.values, _tag, _url, _billUrl]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pick(bool bill) async {
    try {
      final result = await FilePicker.pickFiles(
        type: bill ? FileType.custom : FileType.image,
        allowedExtensions: bill ? ['jpg', 'jpeg', 'png', 'pdf'] : null,
      );
      if (result.isEmpty || !mounted) return;
      final files = <({String name, Uint8List bytes})>[];
      for (final file in bill ? result.take(1) : result) {
        if ((await file.length() ?? 0) > 15 * 1024 * 1024) {
          throw Exception('Choose files smaller than 15 MB.');
        }
        final bytes = await file.readAsBytes();
        if (bytes.length > 15 * 1024 * 1024) {
          throw Exception('Choose files smaller than 15 MB.');
        }
        files.add((name: file.name, bytes: bytes));
      }
      if (!mounted) return;
      setState(() {
        if (bill) {
          _bill = files.first;
          _billUrl.clear();
        } else {
          _photos.addAll(files);
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _addUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null ||
        !['https', 'http'].contains(uri.scheme) ||
        uri.host.isEmpty) {
      setState(() => _error = 'Enter a valid image URL.');
      return;
    }
    setState(() {
      if (!_urls.contains(value.trim())) _urls.add(value.trim());
      _url.clear();
    });
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = ref.read(propertyServiceProvider);
    try {
      final body = <String, dynamic>{
        for (final e in _fields.entries) e.key: e.value.text.trim(),
        'ownerId':
            widget.property?.ownerId ?? ref.read(authStateProvider).value!.id,
        'propertyType': _type,
        'featureTags': _tags.toList(),
        'photoCount': _uploadedPhotoCount + _photos.length + _urls.length,
        'photoUrls': _urls.toList(),
      };
      for (final key in ['bedrooms', 'bathrooms', 'sqft']) {
        body[key] = int.parse(_fields[key]!.text);
      }
      body['monthlyRent'] = double.parse(_fields['monthlyRent']!.text);
      if (isAdmin(ref.read(authStateProvider).value?.role)) {
        body['status'] = [
          'PendingVerification',
          'Active',
          'Suspended',
        ].indexOf(_status);
      }
      if (_savedId == null) {
        final result = await api.request('POST', '/properties', body);
        _savedId = result['id'];
        if (body['status'] != null && body['status'] != 0) {
          await api.request('PUT', '/properties/$_savedId/status', {
            'status': body['status'],
          });
        }
      } else {
        await api.request('PUT', '/properties/$_savedId', body);
      }
      _uploadedPhotoCount += _urls.length;
      _urls.clear();
      var primary = _uploadedPhotoCount == 0;
      while (_photos.isNotEmpty) {
        final photo = _photos.first;
        await api.upload(
          '/properties/$_savedId/photos',
          photo.bytes,
          photo.name,
          {'isPrimary': '$primary'},
        );
        primary = false;
        _uploadedPhotoCount++;
        _photos.removeAt(0);
      }
      if (_bill != null) {
        final document = await api.upload(
          '/properties/$_savedId/documents',
          _bill!.bytes,
          _bill!.name,
          {'documentType': 'UtilityBill'},
        );
        _billUrl.text = document['documentUrl'];
        _bill = null;
      }
      if (_billUrl.text.trim().isNotEmpty) {
        await api.request('POST', '/properties/$_savedId/proof', {
          'documentType': 'UtilityBill',
          'documentUrl': _billUrl.text.trim(),
        });
        _billUrl.clear();
      }
      ref.invalidate(managedPropertiesProvider);
      ref.invalidate(propertiesProvider);
      ref.invalidate(propertyDetailsProvider(_savedId!));
      ref.invalidate(verificationProvider(_savedId!));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      ref.invalidate(managedPropertiesProvider);
      if (mounted) {
        setState(
          () => _error =
              '${_savedId != null ? 'Listing saved. Some changes may still need retrying. ' : ''}$e',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(
    String key,
    String label, {
    int min = 0,
    bool number = false,
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: _fields[key],
      maxLines: lines,
      keyboardType: number
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: label),
      validator: (v) => number
          ? InputValidators.number(v, min: min, integer: key != 'monthlyRent')
          : InputValidators.text(v, label: label, min: min),
    ),
  );
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_busy,
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          widget.property == null ? 'Add New Property' : 'Edit Property',
        ),
      ),
      body: AbsorbPointer(
        absorbing: _busy,
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PageIntro(
                  eyebrow: 'Your property portfolio',
                  title: widget.property == null
                      ? 'Make room for\nsomething new.'
                      : 'Refine your listing.',
                  description: 'Share the details that help someone find their next home.',
                  icon: Icons.add_home_work_outlined,
                ),
                const SizedBox(height: 28),
                const FormHeading(
                  'The essentials',
                  'Start with the story and location of your property.',
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                _field('title', 'Property Title', min: 3),
                _field('description', 'Description', min: 10, lines: 4),
                _field('address', 'Address & City', min: 5),
                DropdownButtonFormField<String>(
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Property Type'),
                  items: propertyTypes
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _type = v!),
                ),
                const SizedBox(height: 14),
                const FormHeading(
                  'Space & pricing',
                  'Set your monthly rent and describe the space.',
                  icon: Icons.grid_view_rounded,
                ),
                _field(
                  'monthlyRent',
                  'Monthly Rent (LKR)',
                  number: true,
                  min: 1,
                ),
                _field('bedrooms', 'Bedrooms', number: true),
                _field('bathrooms', 'Bathrooms', number: true),
                _field('sqft', 'Floor Area (Sqft)', number: true),
                _field(
                  'facilities',
                  'Facilities & Amenities (comma-separated)',
                ),
                Text(
                  'Feature Tags & Highlights (${_tags.length})',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Wrap(
                  spacing: 6,
                  children: {...suggestedTags, ..._tags}
                      .map(
                        (t) => FilterChip(
                          label: Text(t),
                          selected: _tags.contains(t),
                          onSelected: (v) => setState(() {
                            v ? _tags.add(t) : _tags.remove(t);
                          }),
                        ),
                      )
                      .toList(),
                ),
                TextField(
                  controller: _tag,
                  decoration: InputDecoration(
                    labelText: 'Custom feature tag',
                    suffixIcon: IconButton(
                      tooltip: 'Add Tag',
                      icon: const Icon(Icons.add),
                      onPressed: () {
                        if (_tag.text.trim().isNotEmpty) {
                          setState(() {
                            _tags.add(_tag.text.trim());
                            _tag.clear();
                          });
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'Property Photos',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final url in widget.property?.photos ?? <String>[])
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Image.network(
                      url,
                      height: 130,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const Icon(Icons.broken_image),
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: () => _pick(false),
                  icon: const Icon(Icons.add_photo_alternate),
                  label: const Text('Upload Photos'),
                ),
                for (final photo in _photos.toList())
                  ListTile(
                    leading: Image.memory(
                      photo.bytes,
                      width: 48,
                      errorBuilder: (_, _, _) => const Icon(Icons.image),
                    ),
                    title: Text(photo.name),
                    trailing: IconButton(
                      tooltip: 'Remove photo',
                      onPressed: () => setState(() => _photos.remove(photo)),
                      icon: const Icon(Icons.close),
                    ),
                  ),
                TextField(
                  controller: _url,
                  decoration: InputDecoration(
                    labelText: 'Photo URL (https://...)',
                    suffixIcon: IconButton(
                      tooltip: 'Add Photo URL',
                      onPressed: () => _addUrl(_url.text),
                      icon: const Icon(Icons.add),
                    ),
                  ),
                ),
                for (final url in _urls.toList())
                  ListTile(
                    leading: Image.network(
                      url,
                      width: 48,
                      errorBuilder: (_, _, _) => const Icon(Icons.broken_image),
                    ),
                    title: Text(
                      url,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: IconButton(
                      onPressed: () => setState(() => _urls.remove(url)),
                      tooltip: 'Remove photo',
                      icon: const Icon(Icons.close),
                    ),
                  ),
                const Text('Quick sample photos'),
                Wrap(
                  spacing: 6,
                  children: samplePhotos.entries
                      .map(
                        (e) => ActionChip(
                          label: Text(e.key),
                          onPressed: () => _addUrl(e.value),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 24),
                Text(
                  'Electricity / Utility Bill Verification',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const Text(
                  'Attach an electricity bill, water bill or ownership document. The verification service checks it against your listed address.',
                ),
                OutlinedButton.icon(
                  onPressed: () => _pick(true),
                  icon: const Icon(Icons.upload_file),
                  label: Text(
                    _bill?.name ?? 'Upload Bill / Ownership Document',
                  ),
                ),
                if (_bill != null &&
                    !_bill!.name.toLowerCase().endsWith('.pdf'))
                  Image.memory(
                    _bill!.bytes,
                    height: 140,
                    errorBuilder: (_, _, _) => const Icon(Icons.description),
                  ),
                for (final doc
                    in widget.property?.raw['documents'] as List? ?? [])
                  ListTile(
                    leading: const Icon(Icons.description),
                    title: Text('Current document: ${doc['documentType']}'),
                  ),
                if (_bill != null)
                  TextButton(
                    onPressed: () => setState(() => _bill = null),
                    child: const Text('Remove Document'),
                  ),
                TextFormField(
                  controller: _billUrl,
                  decoration: const InputDecoration(
                    labelText: 'Or paste document URL',
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return null;
                    final uri = Uri.tryParse(v.trim());
                    return uri != null &&
                            ['http', 'https'].contains(uri.scheme) &&
                            uri.host.isNotEmpty
                        ? null
                        : 'Enter a valid document URL';
                  },
                ),
                const SizedBox(height: 8),
                const Text('Demo utility bill samples'),
                Wrap(
                  spacing: 6,
                  children: [
                    ActionChip(
                      label: const Text('Electricity Bill Sample'),
                      onPressed: () => setState(() {
                        _bill = null;
                        _billUrl.text = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80';
                      }),
                    ),
                    ActionChip(
                      label: const Text('Water Bill Sample'),
                      onPressed: () => setState(() {
                        _bill = null;
                        _billUrl.text = 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=800&q=80';
                      }),
                    ),
                  ],
                ),
                if (isAdmin(ref.watch(authStateProvider).value?.role)) ...[
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _status,
                    decoration: const InputDecoration(
                      labelText: 'Listing Status',
                    ),
                    items: ['PendingVerification', 'Active', 'Suspended']
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (s) => setState(() => _status = s!),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy ? null : _save,
                  child: Text(
                    _busy ? 'Saving listing & attachments...' : 'Save Property',
                  ),
                ),
                TextButton(
                  onPressed: _busy ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
