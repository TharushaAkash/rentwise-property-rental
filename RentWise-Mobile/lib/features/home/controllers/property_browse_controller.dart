import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../properties/property_service.dart';
import '../models/property_model.dart';

class PropertyBrowseController extends ChangeNotifier {
  final PropertyService api;
  PropertyBrowseController(this.api);
  AsyncValue<List<PropertyModel>> data = const AsyncLoading();
  String? _cursor;
  bool hasMore = false;
  bool loadingMore = false;
  String? error;
  String query = '';
  int _requestVersion = 0;
  Timer? _searchDelay;
  bool _disposed = false;
  void _update(VoidCallback change) {
    if (_disposed) return;
    change();
    notifyListeners();
  }

  Future<void> load({bool more = false}) async {
    if (more && (loadingMore || !hasMore)) return;
    final version = more ? _requestVersion : ++_requestVersion;
    _update(() {
      error = null;
      if (more) {
        loadingMore = true;
      } else {
        data = const AsyncLoading();
        _cursor = null;
        hasMore = false;
        loadingMore = false;
      }
    });
    try {
      final path = Uri(
        path: '/properties/browse',
        queryParameters: {
          'pageSize': '12',
          'location': query,
          if (more && _cursor != null) 'cursor': _cursor!,
        },
      ).toString();
      final response = await api.request('GET', path);
      if (_disposed || version != _requestVersion) return;
      final page = (response['items'] as List)
          .map((p) => PropertyModel.fromJson(Map<String, dynamic>.from(p)))
          .toList();
      _update(() {
        final previous = more
            ? (data.value ?? <PropertyModel>[])
            : <PropertyModel>[];
        data = AsyncData([
          ...previous,
          ...page.where((p) => !previous.any((old) => old.id == p.id)),
        ]);
        _cursor = response['nextCursor'] as String?;
        hasMore = response['hasMore'] == true;
      });
    } catch (e, stack) {
      if (!_disposed && version == _requestVersion) {
        _update(() {
          if (!more) {
            data = AsyncError(e, stack);
          } else {
            error = 'Could not load more properties. Try again.';
          }
        });
      }
    } finally {
      if (!_disposed && version == _requestVersion) {
        _update(() => loadingMore = false);
      }
    }
  }

  void search(String value) {
    query = value;
    hasMore = false;
    loadingMore = false;
    _searchDelay?.cancel();
    _requestVersion++;
    _searchDelay = Timer(const Duration(milliseconds: 350), () => load());
  }

  @override
  void dispose() {
    _disposed = true;
    _requestVersion++;
    _searchDelay?.cancel();
    super.dispose();
  }
}
