// API service functions for communicating with the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'simplified';

class ApiService {
    
    // Helper method for making requests
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Get store information (weights, settings, etc.)
    async getStoreInfo(storeName = STORE_NAME) {
        return this.request(`/store/${storeName}`);
    }

    // Save productivity data
    async saveProductivityData(data) {
        const payload = {
            storeName: STORE_NAME,
            date: data.date,
            daypartsData: {
                breakfast: {
                    sales: data.breakfastSales,
                    actualProductivity: data.actualProductivity.breakfast,
                    targetProductivity: data.targetProductivity.breakfast,
                    picName: data.picNames.breakfast
                },
                lunch: {
                    sales: data.lunchSales,
                    actualProductivity: data.actualProductivity.lunch,
                    targetProductivity: data.targetProductivity.lunch,
                    picName: data.picNames.lunch
                },
                afternoon: {
                    sales: data.afternoonSales,
                    actualProductivity: data.actualProductivity.afternoon,
                    targetProductivity: data.targetProductivity.afternoon,
                    picName: data.picNames.afternoon
                },
                dinner: {
                    sales: data.dinnerSales,
                    actualProductivity: data.actualProductivity.dinner,
                    targetProductivity: data.targetProductivity.dinner,
                    picName: data.picNames.dinner
                }
            },
            operationalWeights: data.daypartWeights,
            ambitionTier: data.selectedTier
        };

        return this.request('/productivity', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    // Load productivity data for a specific date
    async loadProductivityData(date, storeName = STORE_NAME) {
        return this.request(`/productivity/${storeName}/${date}`);
    }

    // Load productivity data for a date range
    async loadProductivityRange(startDate, endDate, storeName = STORE_NAME) {
        return this.request(`/productivity/${storeName}/range/${startDate}/${endDate}`);
    }

    // Check API health
    async healthCheck() {
        return this.request('/health');
    }

    // Format data for dashboard consumption
    formatLoadedData(apiData) {
        // Transform API response back to dashboard format
        const formatted = {
            breakfastSales: apiData.breakfast?.sales ? apiData.breakfast.sales.toString() : '',
            lunchSales: apiData.lunch?.sales ? apiData.lunch.sales.toString() : '',
            afternoonSales: apiData.afternoon?.sales ? apiData.afternoon.sales.toString() : '',
            dinnerSales: apiData.dinner?.sales ? apiData.dinner.sales.toString() : '',
            actualProductivity: {
                breakfast: apiData.breakfast?.actualProductivity ? apiData.breakfast.actualProductivity.toString() : '',
                lunch: apiData.lunch?.actualProductivity ? apiData.lunch.actualProductivity.toString() : '',
                afternoon: apiData.afternoon?.actualProductivity ? apiData.afternoon.actualProductivity.toString() : '',
                dinner: apiData.dinner?.actualProductivity ? apiData.dinner.actualProductivity.toString() : ''
            },
            picNames: {
                breakfast: apiData.breakfast?.picName || '',
                lunch: apiData.lunch?.picName || '',
                afternoon: apiData.afternoon?.picName || '',
                dinner: apiData.dinner?.picName || ''
            }
        };

        return formatted;
    }

    // Export data to CSV format
    async exportToCSV(startDate, endDate, storeName = STORE_NAME) {
        try {
            const data = await this.loadProductivityRange(startDate, endDate, storeName);
            
            // Group by date
            const groupedByDate = data.reduce((acc, record) => {
                const date = record.record_date;
                if (!acc[date]) {
                    acc[date] = {};
                }
                acc[date][record.daypart] = record;
                return acc;
            }, {});

            // Generate CSV content
            const csvRows = [];
            csvRows.push(['Date', 'Daypart', 'Sales', 'Actual Productivity', 'Target Productivity', 'PIC Name']);
            
            Object.entries(groupedByDate).forEach(([date, dayparts]) => {
                ['breakfast', 'lunch', 'afternoon', 'dinner'].forEach(daypart => {
                    const record = dayparts[daypart];
                    if (record) {
                        csvRows.push([
                            date,
                            daypart.charAt(0).toUpperCase() + daypart.slice(1),
                            record.sales_amount || '0',
                            record.actual_productivity || '0',
                            record.target_productivity || '0',
                            record.pic_name || ''
                        ]);
                    }
                });
            });

            // Convert to CSV string
            const csvContent = csvRows.map(row => row.join('\t')).join('\n');
            
            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `productivity-data-${storeName}-${startDate}-${endDate}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            return { success: true, recordCount: data.length };
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;