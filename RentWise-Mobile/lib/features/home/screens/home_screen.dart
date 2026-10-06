import '../../auth/screens/login_screen.dart';

import 'dart:async';

import '../../notifications/booking_notifications.dart';
import '../../properties/saved_properties.dart';
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
  final Set<int> _visitedTabs = {0};

  @override
  Widget build(BuildContext context) {
    final userState = ref.watch(authStateProvider);
    if (userState.value == null) return const LoginScreen();
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
      appBar: property_access.isOwner(userState.value?.role)
          ? AppBar(
              toolbarHeight: 44,
              title: const Text('RentWise'),
              actions: [
                BookingNotificationBell(key: ValueKey(userState.value?.id)),
              ],
            )
          : null,
      body: KeyedSubtree(
        key: ValueKey('${userState.value?.id}:${userState.value?.role}'),
        child: IndexedStack(
          index: _tab,
          children: [
            for (var index = 0; index < pages.length; index++)
              TickerMode(
                enabled: index == _tab,
                child: _visitedTabs.contains(index)
                    ? pages[index]
                    : const SizedBox.shrink(),
              ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(0xFFFAFBF5),
        indicatorColor: const Color(0xFFD8EF54),
        height: 70,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() {
          _visitedTabs.add(index);
          _tab = index;
        }),
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

class _DiscoverPropertiesTabState extends ConsumerState<_DiscoverPropertiesTab>
    with WidgetsBindingObserver {
  Timer? _refreshTimer;
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
    WidgetsBinding.instance.addObserver(this);
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted &&
          !_isAiSearching &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _catalog.refreshAvailability();
      }
    });
    _catalog.addListener(_catalogChanged);
    _catalog.load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _catalog.refreshAvailability();
  }

  void _catalogChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadBrowse({bool more = false}) =>
      _catalog.load(more: more, background: _catalog.data.value != null);
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
    _refreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
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
      ref.invalidate(propertiesProvider);
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

  String _category = 'All';
  bool _showSearch = false;
  static const _lime = Color(0xFFD8EF54);
  static const _paper = Color(0xFFFAFBF5);

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).value;
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
    return Scaffold(
      backgroundColor: _paper,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _loadBrowse(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(22, 16, 22, 8),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              greeting,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF30332B),
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Saved properties',
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const SavedPropertiesScreen(),
                              ),
                            ),
                            icon: const Icon(Icons.favorite_border, size: 22),
                          ),
                          Semantics(
                            label: 'Open profile',
                            button: true,
                            child: InkWell(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const ProfileScreen(),
                                ),
                              ),
                              borderRadius: BorderRadius.circular(24),
                              child: CircleAvatar(
                                radius: 19,
                                backgroundColor: const Color(0xFFE6EAD9),
                                child: Text(
                                  user != null && user.name.trim().isNotEmpty
                                      ? user.name.trim()[0].toUpperCase()
                                      : 'R',
                                  style: const TextStyle(
                                    color: Color(0xFF293323),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Expanded(
                            child: Text(
                              'Find your\nnext stay',
                              style: TextStyle(
                                fontSize: 34,
                                height: 1.03,
                                letterSpacing: -1.3,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF151813),
                              ),
                            ),
                          ),
                          IconButton.filledTonal(
                            tooltip: 'Search properties',
                            style: IconButton.styleFrom(
                              backgroundColor: _paper,
                              side: const BorderSide(color: Color(0xFFE2E5D9)),
                              minimumSize: const Size(48, 48),
                            ),
                            onPressed: () =>
                                setState(() => _showSearch = !_showSearch),
                            icon: const Icon(
                              Icons.search,
                              color: Color(0xFF151813),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 40,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: 5,
                          separatorBuilder: (_, index) =>
                              const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            final category = [
                              'All',
                              'House',
                              'Apartment',
                              'Villa',
                              'Studio',
                            ][index];
                            return ChoiceChip(
                              label: Text(category),
                              selected: _category == category,
                              showCheckmark: false,
                              selectedColor: _lime,
                              backgroundColor: const Color(0xFFF0F2E9),
                              side: BorderSide.none,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                              labelStyle: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF151813),
                              ),
                              onSelected: (_) {
                                setState(() => _category = category);
                                _catalog.propertyType = category == 'All'
                                    ? ''
                                    : category;
                                _catalog.load();
                              },
                            );
                          },
                        ),
                      ),
                      if (_showSearch || _isAiSearch) ...[
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                onChanged: (value) {
                                  _searchQuery = value;
                                  if (!_isAiSearch) _normalSearchChanged();
                                },
                                onSubmitted: (_) {
                                  if (_isAiSearch) _runAiSearch(const []);
                                },
                                decoration: InputDecoration(
                                  hintText: _isAiSearch
                                      ? 'Describe your ideal place...'
                                      : 'Search a location...',
                                  prefixIcon: const Icon(Icons.search),
                                  filled: true,
                                  fillColor: Colors.white,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(18),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFE2E5D9),
                                    ),
                                  ),
                                  suffixIcon: IconButton(
                                    tooltip: 'Clear search',
                                    icon: const Icon(Icons.close, size: 18),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() {
                                        _searchQuery = '';
                                        _aiSearchResult = null;
                                      });
                                      _normalSearchChanged();
                                    },
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filled(
                              tooltip: _isAiSearch
                                  ? 'Run AI search'
                                  : 'Search with AI',
                              style: IconButton.styleFrom(
                                backgroundColor: _lime,
                                foregroundColor: const Color(0xFF151813),
                              ),
                              onPressed: _isAiSearching
                                  ? null
                                  : () {
                                      if (_isAiSearch) {
                                        _runAiSearch(const []);
                                      } else {
                                        setState(() => _isAiSearch = true);
                                        _catalog.search('');
                                      }
                                    },
                              icon: _isAiSearching
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.auto_awesome),
                            ),
                          ],
                        ),
                        if (_isAiSearch) ...[
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            children: _samplePrompts
                                .take(2)
                                .map(
                                  (prompt) => ActionChip(
                                    label: Text(
                                      prompt,
                                      style: const TextStyle(fontSize: 10),
                                    ),
                                    onPressed: () =>
                                        _applyPrompt(prompt, const []),
                                  ),
                                )
                                .toList(),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _isAiSearch = false;
                                _aiSearchResult = null;
                              });
                              _normalSearchChanged();
                            },
                            child: const Text('Use location search'),
                          ),
                        ],
                      ],
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _isAiSearch && _aiSearchResult != null
                                  ? 'AI matches for you'
                                  : 'Explore properties',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -.4,
                                color: Color(0xFF151813),
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _category = 'All';
                                _isAiSearch = false;
                                _aiSearchResult = null;
                                _searchQuery = '';
                                _searchController.clear();
                              });
                              _catalog.propertyType = '';
                              _catalog.search('');
                            },
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'See all',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF151813),
                                  ),
                                ),
                                Icon(
                                  Icons.chevron_right,
                                  size: 16,
                                  color: Color(0xFF151813),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              ..._browse.when<List<Widget>>(
                loading: () => [
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(48),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ),
                ],
                error: (error, stack) => [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          const Text('Could not load properties.'),
                          TextButton(
                            onPressed: () => _loadBrowse(),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                data: (properties) {
                  final matches = _isAiSearch && _aiSearchResult != null
                      ? _aiSearchResult!.results
                            .where(
                              (match) =>
                                  !_catalog.unavailableIds.contains(
                                    match.property.id,
                                  ) &&
                                  (_category == 'All' ||
                                      match.property.propertyType
                                              .toLowerCase() ==
                                          _category.toLowerCase()),
                            )
                            .toList()
                      : null;
                  final displayed = matches != null
                      ? matches.map((match) => match.property).toList()
                      : properties;
                  return [
                    if (displayed.isEmpty)
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Column(
                            children: [
                              Icon(Icons.search_off_rounded, size: 36),
                              SizedBox(height: 12),
                              Text(
                                'No properties found. Try another location or category.',
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 22),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => _MobilePropertyCard(
                            property: displayed[index],
                            aiResult: matches?[index],
                            onReturn: () => _catalog.refreshAvailability(),
                          ),
                          childCount: displayed.length,
                        ),
                      ),
                    ),
                    if (!_isAiSearch && (_hasMore || _browseError != null))
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              if (_browseError != null) Text(_browseError!),
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
                        ),
                      ),
                    const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  ];
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MobilePropertyCard extends StatelessWidget {
  final VoidCallback? onReturn;
  final dynamic property;
  final AiPropertyMatchResult? aiResult;
  const _MobilePropertyCard({
    required this.property,
    this.aiResult,
    this.onReturn,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  PropertyDetailScreen(property: property, aiResult: aiResult),
            ),
          ).then((_) => onReturn?.call()),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(5),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(
                    children: [
                      AspectRatio(
                        aspectRatio: 1.85,
                        child: property.photoUrl.isNotEmpty
                            ? Image.network(
                                property.photoUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, error, stack) =>
                                    _placeholder(),
                              )
                            : _placeholder(),
                      ),
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                aiResult != null
                                    ? Icons.auto_awesome
                                    : Icons.home_outlined,
                                size: 13,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                aiResult != null
                                    ? '${aiResult!.matchScore}% Match'
                                    : property.propertyType,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        top: 6,
                        right: 6,
                        child: SavePropertyButton(propertyId: property.id),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                property.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF151813),
                                  letterSpacing: -.3,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 13,
                                    color: Color(0xFF666B61),
                                  ),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Text(
                                      property.address,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF666B61),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'LKR ${_fmtMoney(property.monthlyRent)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF151813),
                              ),
                            ),
                            const Text(
                              '/ month',
                              style: TextStyle(
                                fontSize: 10,
                                color: Color(0xFF666B61),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 13),
                    Wrap(
                      spacing: 16,
                      runSpacing: 8,
                      children: [
                        _feature(
                          Icons.bed_outlined,
                          '${property.bedrooms} Beds',
                        ),
                        _feature(
                          Icons.bathtub_outlined,
                          '${property.bathrooms} Baths',
                        ),
                        _feature(Icons.square_foot, '${property.sqft} sq ft'),
                      ],
                    ),
                    if (aiResult != null)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.softTeal,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.auto_awesome,
                                  size: 15,
                                  color: AppColors.teal,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    aiResult!.destinationLandmark.isEmpty
                                        ? 'Commute details'
                                        : 'To ${aiResult!.destinationLandmark}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.ink,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 14,
                              runSpacing: 6,
                              children: [
                                _feature(
                                  Icons.near_me_outlined,
                                  aiResult!.distanceKm == null
                                      ? 'Distance unavailable'
                                      : '${aiResult!.distanceKm} km',
                                ),
                                _feature(
                                  Icons.schedule_outlined,
                                  aiResult!.travelTimeMins == null
                                      ? 'Travel time unavailable'
                                      : '~${aiResult!.travelTimeMins} min',
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              aiResult!.commuteSummary.isNotEmpty
                                  ? aiResult!.commuteSummary
                                  : 'AI estimates; not live traffic or route calculations.',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.muted,
                              ),
                            ),
                            if (aiResult!.matchReasons.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              const Text(
                                'Why this matches',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.ink,
                                ),
                              ),
                              ...aiResult!.matchReasons.map(
                                (reason) => Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Padding(
                                        padding: EdgeInsets.only(
                                          top: 3,
                                          right: 6,
                                        ),
                                        child: Icon(
                                          Icons.check_circle_outline,
                                          size: 13,
                                          color: AppColors.teal,
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          reason,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            height: 1.4,
                                            color: AppColors.ink,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placeholder() =>
      Image.asset('assets/property_placeholder.jpg', fit: BoxFit.cover);
  Widget _feature(IconData icon, String text) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 15, color: const Color(0xFF51574A)),
      const SizedBox(width: 5),
      Text(
        text,
        style: const TextStyle(fontSize: 11, color: Color(0xFF30332B)),
      ),
    ],
  );
  String _fmtMoney(dynamic value) =>
      (num.tryParse(value?.toString() ?? '') ?? 0)
          .toStringAsFixed(0)
          .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
}
