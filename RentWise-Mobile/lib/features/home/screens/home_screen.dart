import '../controllers/property_browse_controller.dart';

import '../models/property_model.dart';
import '../../workflows/workflow_screens.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../profile/screens/profile_screen.dart';
import '../providers/property_provider.dart';
import '../../../utils/ai_property_matcher.dart';
import '../../properties/screens/property_detail_screen.dart';
import '../../properties/screens/properties_dashboard_screen.dart';
import '../../properties/property_service.dart' as property_access;
import '../../rentals/screens/my_rentals_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final userState = ref.watch(authStateProvider);
    final isOwner =
        property_access.isOwner(userState.value?.role) ||
        property_access.isAdmin(userState.value?.role);

    final List<Widget> pages = isOwner
        ? [
            const PropertiesDashboardScreen(),
            const PropertyBookingsScreen(),
            const MyRentalsScreen(),
            const ProfileScreen(),
          ]
        : [
            const _DiscoverPropertiesTab(),
            const PropertyBookingsScreen(),
            const MyRentalsScreen(),
            const ProfileScreen(),
          ];

    pages.insert(
      2,
      RentalRequestsScreen(canCreate: userState.value?.role == 'Tenant'),
    );
    return Scaffold(
      body: pages[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: isOwner ? 'Properties' : 'Explore',
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_today_outlined),
            selectedIcon: const Icon(Icons.calendar_month),
            label: isOwner ? 'Tenants' : 'Bookings',
          ),
          const NavigationDestination(
            icon: Icon(Icons.forum_outlined),
            selectedIcon: Icon(Icons.forum),
            label: 'Requests',
          ),
          const NavigationDestination(
            icon: Icon(Icons.key_outlined),
            selectedIcon: Icon(Icons.key),
            label: 'Rentals',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _DiscoverPropertiesTab extends ConsumerStatefulWidget {
  const _DiscoverPropertiesTab();

  @override
  ConsumerState<_DiscoverPropertiesTab> createState() =>
      _DiscoverPropertiesTabState();
}

class _DiscoverPropertiesTabState
    extends ConsumerState<_DiscoverPropertiesTab> {
  late final PropertyBrowseController _catalog;
  AsyncValue<List<PropertyModel>> get _browse => _catalog.data;
  bool get _hasMore => _catalog.hasMore;
  bool get _loadingMore => _catalog.loadingMore;
  String? get _browseError => _catalog.error;
  @override
  void initState() {
    super.initState();
    _catalog = PropertyBrowseController(
      ref.read(property_access.propertyServiceProvider),
    );
    _catalog.addListener(_catalogChanged);
    _catalog.load();
  }

  void _catalogChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadBrowse({bool more = false}) => _catalog.load(more: more);
  void _normalSearchChanged() =>
      _catalog.search(_isAiSearch ? '' : _searchQuery);

  bool _isAiSearch = false;
  bool _isAiSearching = false;
  String _searchQuery = '';
  AiSearchResult? _aiSearchResult;
  final TextEditingController _searchController = TextEditingController();

  final List<String> _samplePrompts = [
    '2-bed near SLIIT Malabe under 75k',
    'Colombo 07 luxury apartment',
    'Near Orion City IT Park with AC',
    'Budget place in Dehiwala with parking',
  ];

  @override
  void dispose() {
    _catalog.removeListener(_catalogChanged);
    _catalog.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _runAiSearch(List<dynamic> allProperties) async {
    if (_searchQuery.trim().isEmpty) return;
    setState(() {
      _isAiSearching = true;
      _aiSearchResult = null;
    });

    try {
      final allCandidates = await ref.read(propertiesProvider.future);
      final result = await matchPropertiesWithAi(_searchQuery, allCandidates);
      if (mounted) {
        setState(() {
          _aiSearchResult = result;
        });
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            duration: const Duration(seconds: 10),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isAiSearching = false;
        });
      }
    }
  }

  void _applyPrompt(String prompt, List<dynamic> properties) {
    _searchController.text = prompt;
    _searchQuery = prompt;
    _runAiSearch(properties);
  }

  @override
  Widget build(BuildContext context) {
    final propertiesAsync = _browse;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Find your place',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
      ),
      body: propertiesAsync.when(
        data: (properties) {
          List<dynamic> displayedProperties = properties;
          List<AiPropertyMatchResult>? aiMatchResults;

          if (_searchQuery.trim().isNotEmpty) {
            if (_isAiSearch && _aiSearchResult != null) {
              aiMatchResults = _aiSearchResult!.results;
              displayedProperties = aiMatchResults
                  .map((r) => r.property)
                  .toList();
            }
          }

          return RefreshIndicator(
            onRefresh: () => _loadBrowse(),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'RENTWISE AI INTELLIGENCE',
                              style: TextStyle(
                                fontSize: 10,
                                letterSpacing: 1.8,
                                color: AppColors.teal,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'A space for your next chapter.',
                              style: TextStyle(
                                fontSize: 22,
                                height: 1.15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink,
                                letterSpacing: -.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.softTeal,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: const Icon(
                          Icons.cottage_outlined,
                          color: AppColors.teal,
                          size: 28,
                        ),
                      ),
                    ],
                  ),
                ),

                // ── AI Search Card ──────────────────────────────────────────
                _isAiSearch
                    ? Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF293F35),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.blue.withAlpha(80)),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.teal.withAlpha(60),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.blue.withAlpha(50),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Colors.blue.withAlpha(80),
                                        ),
                                      ),
                                      child: const Icon(
                                        Icons.auto_awesome,
                                        color: Colors.amberAccent,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'Search by AI',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 16,
                                          ),
                                        ),
                                        Text(
                                          'Matching & Location Intelligence',
                                          style: TextStyle(
                                            color: Colors.blue.shade200,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _isAiSearch = false;
                                      _normalSearchChanged();
                                      _searchController.clear();
                                      _searchQuery = '';
                                      _aiSearchResult = null;
                                    });
                                  },
                                  icon: const Icon(
                                    Icons.close,
                                    color: Colors.white70,
                                    size: 20,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),

                            // Prompt Input Field
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _searchController,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    onSubmitted: (val) {
                                      _searchQuery = val;
                                      _normalSearchChanged();
                                      _runAiSearch(properties);
                                    },
                                    decoration: InputDecoration(
                                      hintText: 'e.g. 2 bed near SLIIT Malabe under 75k...',
                                      hintStyle: TextStyle(
                                        color: Colors.white.withAlpha(120),
                                        fontSize: 12,
                                      ),
                                      filled: true,
                                      fillColor: Colors.white.withAlpha(30),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 12,
                                          ),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(14),
                                        borderSide: BorderSide.none,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                InkWell(
                                  onTap: () {
                                    _searchQuery = _searchController.text;
                                    _runAiSearch(properties);
                                  },
                                  borderRadius: BorderRadius.circular(14),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 13,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF426253),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.lightBlue.withAlpha(
                                            100,
                                          ),
                                          blurRadius: 8,
                                        ),
                                      ],
                                    ),
                                    child: _isAiSearching
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.auto_awesome,
                                            color: Colors.amberAccent,
                                            size: 20,
                                          ),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 12),

                            // Sample Prompt Chips
                            SizedBox(
                              height: 30,
                              child: ListView.builder(
                                scrollDirection: Axis.horizontal,
                                itemCount: _samplePrompts.length,
                                itemBuilder: (context, i) {
                                  final p = _samplePrompts[i];
                                  return GestureDetector(
                                    onTap: () => _applyPrompt(p, properties),
                                    child: Container(
                                      margin: const EdgeInsets.only(right: 8),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withAlpha(20),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: Colors.white.withAlpha(40),
                                        ),
                                      ),
                                      child: Text(
                                        p,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      )
                    : Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                onChanged: (val) {
                                  setState(() {
                                    _searchQuery = val;
                                    _normalSearchChanged();
                                  });
                                },
                                decoration: InputDecoration(
                                  hintText: 'Search properties...',
                                  prefixIcon: const Icon(
                                    Icons.search_rounded,
                                    color: AppColors.muted,
                                  ),
                                  suffixIcon: _searchQuery.isNotEmpty
                                      ? IconButton(
                                          icon: const Icon(
                                            Icons.clear,
                                            size: 20,
                                          ),
                                          onPressed: () {
                                            _searchController.clear();
                                            setState(() {
                                              _searchQuery = '';
                                              _normalSearchChanged();
                                            });
                                          },
                                        )
                                      : null,
                                  filled: true,
                                  fillColor: Colors.white,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: const BorderSide(
                                      color: AppColors.line,
                                    ),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: const BorderSide(
                                      color: AppColors.line,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            InkWell(
                              onTap: () {
                                setState(() {
                                  _isAiSearch = true;
                                });
                              },
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                padding: const EdgeInsets.all(13),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF293F35),
                                  borderRadius: BorderRadius.circular(14),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.teal.withAlpha(60),
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.auto_awesome,
                                  color: Colors.amberAccent,
                                  size: 20,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                if (_isAiSearch && _aiSearchResult != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 6,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.auto_awesome,
                          size: 14,
                          color: Color(0xFF426253),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'AI Matched ${displayedProperties.length} Properties to "${_aiSearchResult!.destinationLandmark}"',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF385345),
                          ),
                        ),
                      ],
                    ),
                  ),

                Expanded(
                  child: displayedProperties.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 70,
                                  height: 70,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFF1F5F9),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.search_off_rounded,
                                    size: 32,
                                    color: AppColors.muted,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _isAiSearch
                                      ? 'No AI matches for "${_aiSearchResult?.destinationLandmark ?? _searchQuery}"'
                                      : 'No properties found',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'Try searching for another location like SLIIT Malabe, Colombo 07, Kandy, or Galle.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.muted,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 20),
                                OutlinedButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      _isAiSearch = false;
                                      _normalSearchChanged();
                                      _searchController.clear();
                                      _searchQuery = '';
                                      _aiSearchResult = null;
                                    });
                                  },
                                  icon: const Icon(
                                    Icons.refresh_rounded,
                                    size: 16,
                                  ),
                                  label: const Text('Reset Search'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.ink,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 8,
                          ),
                          itemCount:
                              displayedProperties.length +
                              (!_isAiSearch &&
                                      (_hasMore || _browseError != null)
                                  ? 1
                                  : 0),
                          itemBuilder: (context, index) {
                            if (index == displayedProperties.length) {
                              return Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    if (_browseError != null)
                                      Text(_browseError!),
                                    OutlinedButton(
                                      onPressed: _loadingMore
                                          ? null
                                          : () => _loadBrowse(more: true),
                                      child: Text(
                                        _loadingMore
                                            ? 'Loading...'
                                            : _browseError != null
                                            ? 'Retry'
                                            : 'Load more',
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }
                            return _MobilePropertyCard(
                              property: displayedProperties[index],
                              aiResult:
                                  aiMatchResults != null &&
                                      index < aiMatchResults.length
                                  ? aiMatchResults[index]
                                  : null,
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Failed to load properties',
                style: TextStyle(color: Colors.red),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () => _loadBrowse(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MobilePropertyCard extends StatelessWidget {
  final dynamic property;
  final AiPropertyMatchResult? aiResult;

  const _MobilePropertyCard({required this.property, this.aiResult});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) =>
                  PropertyDetailScreen(property: property, aiResult: aiResult),
            ),
          );
        },
        borderRadius: BorderRadius.circular(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo Banner
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(22),
                  ),
                  child: property.photoUrl.isNotEmpty
                      ? Image.network(
                          property.photoUrl,
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              _buildPlaceholder(),
                        )
                      : _buildPlaceholder(),
                ),
                if (aiResult != null)
                  Positioned(
                    top: 14,
                    left: 14,
                    child: Row(
                      children: [
                        // Match Score Badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF426253),
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withAlpha(50),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.auto_awesome,
                                color: Colors.amberAccent,
                                size: 13,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${aiResult!.matchScore}% Match',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Distance Badge
                        if (aiResult!.distanceKm != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withAlpha(200),
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withAlpha(50),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.navigation_rounded,
                                  color: Colors.lightBlueAccent,
                                  size: 12,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'AI estimate: ${aiResult!.distanceKm} km',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 11,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                if (aiResult == null)
                  Positioned(
                    top: 14,
                    left: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.star_rounded,
                            color: Colors.orange[400],
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'Featured',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                Positioned(
                  top: 14,
                  right: 14,
                  child: CircleAvatar(
                    backgroundColor: Colors.white,
                    radius: 18,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(
                        Icons.favorite_border_rounded,
                        size: 20,
                        color: AppColors.muted,
                      ),
                      onPressed: () {},
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    property.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_rounded,
                        size: 14,
                        color: AppColors.muted,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          property.address,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _buildFeature(
                        Icons.bed_rounded,
                        '${property.bedrooms} Beds',
                      ),
                      const SizedBox(width: 12),
                      _buildFeature(
                        Icons.bathtub_rounded,
                        '${property.bathrooms} Baths',
                      ),
                      const SizedBox(width: 12),
                      _buildFeature(
                        Icons.square_foot_rounded,
                        '${property.sqft} sqft',
                      ),
                    ],
                  ),

                  if (aiResult != null &&
                      aiResult!.matchReasons.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F4F1),
                        border: Border.all(color: const Color(0xFFD8E3D7)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.explore_rounded,
                                size: 15,
                                color: Color(0xFF426253),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  aiResult!.destinationLandmark.trim().isEmpty
                                      ? 'Add a destination to see distance and travel time.'
                                      : aiResult!.distanceKm == null
                                      ? 'AI could not estimate this commute. Try a clearer landmark.'
                                      : 'AI estimate: ${aiResult!.distanceKm} km / ~${aiResult!.travelTimeMins ?? "?"} mins to ${aiResult!.destinationLandmark} (not live traffic)',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF385345),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...aiResult!.matchReasons
                              .take(3)
                              .map(
                                (reason) => Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: 4,
                                    left: 2,
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        '•',
                                        style: TextStyle(
                                          color: Color(0xFF426253),
                                          fontSize: 14,
                                          height: 1.2,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          reason,
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AppColors.ink,
                                            height: 1.4,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 14),
                  const Divider(height: 1, color: AppColors.line),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Monthly Rent',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'LKR ${_fmtMoney(property.monthlyRent)}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.teal,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.teal,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'View Details',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      height: 180,
      color: const Color(0xFFE2E8F0),
      child: const Icon(
        Icons.apartment_rounded,
        size: 50,
        color: AppColors.muted,
      ),
    );
  }

  Widget _buildFeature(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.muted),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }

  String _fmtMoney(dynamic v) {
    final numVal = num.tryParse(v?.toString() ?? '') ?? 0;
    return numVal
        .toStringAsFixed(0)
        .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
  }
}
