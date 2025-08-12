
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { LoanProduct, LoanProvider, TransactionProduct } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { produce,-v } from 'immer';
import type { ScoringParameters } from '@/app/api/scoring-configs/route';
import { Loader2 } from 'lucide-react';
import { deepClone } from 'fast-json-patch';

const ParameterToggle = ({ label, isChecked, onCheckedChange, color }: { label: string; isChecked: boolean; onCheckedChange: (checked: boolean) => void, color?: string }) => (
    <div className="flex items-center justify-between space-x-2 pb-4 border-b">
        <Label htmlFor={`${label}-switch`} className="font-medium capitalize">{label.replace(/([A-Z])/g, ' $1')}</Label>
        <Switch
            id={`${label}-switch`}
            checked={isChecked}
            onCheckedChange={onCheckedChange}
            style={{'--primary': color} as React.CSSProperties}
            className="data-[state=checked]:bg-[--primary]"
        />
    </div>
);

const ParameterSlider = ({ label, value, onValueChange, isEnabled, color }: { label: string; value: number; onValueChange: (value: number[]) => void; isEnabled: boolean; color?: string; }) => {
  if (!isEnabled) return null;
  return (
    <div className="space-y-2 pt-4">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-medium">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={onValueChange}
        max={100}
        step={1}
        style={{'--primary': color} as React.CSSProperties}
        className="[&>span:first-child]:bg-[--primary] [&>span:last-child]:border-[--primary]"
      />
    </div>
  );
};

const GenderImpactInput = ({ label, value, onValueChange }: { label: string; value: number; onValueChange: (event: React.ChangeEvent<HTMLInputElement>) => void; }) => {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="number"
                value={value}
                onChange={onValueChange}
                placeholder="Enter impact value"
            />
        </div>
    );
}

interface ScoringEngineClientProps {
    providers: LoanProvider[];
    transactionProducts: TransactionProduct[];
    initialScoringConfigs: Record<string, ScoringParameters>;
}

export function ScoringEngineClient({ providers, transactionProducts, initialScoringConfigs }: ScoringEngineClientProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [scoringConfigs, setScoringConfigs] = useState(initialScoringConfigs);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [newOccupation, setNewOccupation] = React.useState('');

  useEffect(() => {
    if (providers.length > 0 && !selectedProviderId) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const currentParameters = useMemo(() => {
    return scoringConfigs[selectedProviderId] || null;
  }, [scoringConfigs, selectedProviderId]);
  
  const selectedProvider = useMemo(() => providers.find(p => p.id === selectedProviderId), [providers, selectedProviderId]);
  const themeColor = selectedProvider?.colorHex || '#fdb913';

  const updateConfigForProvider = (providerId: string, updatedConfig: ScoringParameters) => {
      setScoringConfigs(produce(draft => {
          draft[providerId] = updatedConfig;
      }));
  }

  const totalWeight = useMemo(() => {
    if (!currentParameters) return 0;
    
    let sum = 0;
    const { weights } = currentParameters;

    if (weights.age.enabled) sum += weights.age.value;
    if (weights.transactionHistoryTotal.enabled) sum += weights.transactionHistoryTotal.value;
    if (weights.loanHistoryCount.enabled) sum += weights.loanHistoryCount.value;
    if (weights.onTimeRepayments.enabled) sum += weights.onTimeRepayments.value;
    if (weights.salary.enabled) sum += weights.salary.value;
    
    if (weights.transactionHistoryByProduct.enabled) {
      sum += Object.values(weights.transactionHistoryByProduct.values || {}).reduce((acc, w) => acc + w, 0);
    }

    return sum;
  }, [currentParameters]);

  const handleSave = async () => {
    if (totalWeight > 100) {
        toast({
            title: 'Invalid Configuration',
            description: 'The total weight of all enabled parameters must not exceed 100%.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsLoading(true);
    try {
        const response = await fetch('/api/scoring-configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId: selectedProviderId, config: currentParameters }),
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || 'Failed to save configuration.');
        }

        const savedConfig = await response.json();
        updateConfigForProvider(selectedProviderId, savedConfig);

        toast({
          title: 'Parameters Saved',
          description: `Credit scoring parameters for ${selectedProvider?.name} have been updated.`,
        });

    } catch (error: any) {
        toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleConfigChange = (updater: (draft: ScoringParameters) => void) => {
    if (!currentParameters) return;
    const updatedConfig = produce(currentParameters, updater);
    updateConfigForProvider(selectedProviderId, updatedConfig);
  }

  const handleAddOccupation = () => {
    if (newOccupation.trim()) {
      handleConfigChange(draft => {
        if (!draft.occupationRisk.values[newOccupation.trim()]) {
            draft.occupationRisk.values[newOccupation.trim()] = 'Medium';
        }
      });
      setNewOccupation('');
    }
  };
  
  const handleRemoveOccupation = (occupation: string) => {
    handleConfigChange(draft => {
      delete draft.occupationRisk.values[occupation];
    });
  }

  const handleProductSelectionChange = (productId: string, isChecked: boolean) => {
    handleConfigChange(draft => {
        const currentSelected = draft.productIds || [];
        const newSelected = isChecked
          ? [...currentSelected, productId]
          : currentSelected.filter(id => id !== productId);
        draft.productIds = newSelected;
    });
  };

   const handleReset = async () => {
    setIsLoading(true);
    try {
        const response = await fetch('/api/scoring-configs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId: selectedProviderId }),
        });

        if (!response.ok) throw new Error('Failed to reset configuration.');
        
        const defaultConfig = await response.json();
        updateConfigProvider(selectedProviderId, defaultConfig);

        toast({
            title: 'Configuration Reset',
            description: `Parameters for ${selectedProvider?.name} have been reset to defaults.`,
        });
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };
  
  if (!selectedProviderId || !currentParameters || providers.length === 0) {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
             <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
             </div>
        </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6" style={{'--primary': themeColor} as React.CSSProperties}>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
        <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 mr-4">
                <span className="text-sm font-medium">Total Weight:</span>
                <span className={cn("text-lg font-bold", totalWeight > 100 ? 'text-red-600' : 'text-green-600')}>
                    {totalWeight}%
                </span>
            </div>
            <Button variant="outline" onClick={handleReset} disabled={isLoading}>Reset to Defaults</Button>
            <Button onClick={handleSave} style={{backgroundColor: themeColor}} className="text-white" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
            </Button>
        </div>
      </div>

       <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
            Configure the parameters and weights used to calculate customer credit scores for the selected provider.
        </p>
        <div>
             <Label>Provider</Label>
             <Select onValueChange={setSelectedProviderId} value={selectedProviderId}>
                <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                    {providers.map(provider => (
                        <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>
      
      {selectedProvider && (
        <Card>
            <CardHeader>
                <CardTitle>Applied Products</CardTitle>
                <CardDescription>Select which products from {selectedProvider.name} this scoring model applies to.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedProvider.products.map((product: LoanProduct) => (
                    <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`product-${product.id}`}
                            checked={currentParameters.productIds?.includes(product.id)}
                            onCheckedChange={(checked) => handleProductSelectionChange(product.id, !!checked)}
                            style={{'--primary': themeColor} as React.CSSProperties}
                            className="border-[--primary] data-[state=checked]:bg-[--primary] data-[state=checked]:border-[--primary]"
                        />
                        <Label htmlFor={`product-${product.id}`} className="font-normal">{product.name}</Label>
                    </div>
                ))}
            </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demographics</CardTitle>
            <CardDescription>Weights for user demographic data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
                <ParameterToggle
                    label="Age"
                    isChecked={currentParameters.weights.age.enabled}
                    onCheckedChange={(checked) => handleConfigChange(draft => { draft.weights.age.enabled = checked; })}
                    color={themeColor}
                />
                <ParameterSlider
                  label="Weight"
                  value={currentParameters.weights.age.value}
                  onValueChange={(v) => handleConfigChange(draft => { draft.weights.age.value = v[0]; })}
                  isEnabled={currentParameters.weights.age.enabled}
                  color={themeColor}
                />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="gender-factor-switch" className="font-medium">Factor in Gender</Label>
              <Switch
                id="gender-factor-switch"
                checked={currentParameters.genderImpact.enabled}
                onCheckedChange={(checked) => handleConfigChange(draft => { draft.genderImpact.enabled = checked; })}
                style={{'--primary': themeColor} as React.CSSProperties}
                className="data-[state=checked]:bg-[--primary]"
              />
            </div>
             {currentParameters.genderImpact.enabled && (
              <>
                <Separator />
                <div className="pt-4 space-y-4">
                    <GenderImpactInput
                        label="Male Impact"
                        value={currentParameters.genderImpact.male}
                        onValueChange={(e) => handleConfigChange(draft => { draft.genderImpact.male = parseFloat(e.target.value) || 0; })}
                    />
                    <GenderImpactInput
                        label="Female Impact"
                        value={currentParameters.genderImpact.female}
                        onValueChange={(e) => handleConfigChange(draft => { draft.genderImpact.female = parseFloat(e.target.value) || 0; })}
                    />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Weights for overall and product-specific transaction history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
                <ParameterToggle
                    label="Transaction History Total"
                    isChecked={currentParameters.weights.transactionHistoryTotal.enabled}
                    onCheckedChange={(checked) => handleConfigChange(draft => { draft.weights.transactionHistoryTotal.enabled = checked; })}
                    color={themeColor}
                />
                <ParameterSlider
                  label="Weight"
                  value={currentParameters.weights.transactionHistoryTotal.value}
                  onValueChange={(v) => handleConfigChange(draft => { draft.weights.transactionHistoryTotal.value = v[0]; })}
                  isEnabled={currentParameters.weights.transactionHistoryTotal.enabled}
                  color={themeColor}
                />
            </div>
            <Separator/>
            <div>
                <ParameterToggle
                    label="Transaction History By Product"
                    isChecked={currentParameters.weights.transactionHistoryByProduct.enabled}
                    onCheckedChange={(checked) => handleConfigChange(draft => { draft.weights.transactionHistoryByProduct.enabled = checked; })}
                    color={themeColor}
                />
                {currentParameters.weights.transactionHistoryByProduct.enabled && (
                    <div className="space-y-2 pt-4">
                        <Label>Product Weights</Label>
                        <Card className="mt-2 bg-muted/50">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right w-[120px]">Weight (%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactionProducts.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-right"
                                                    value={currentParameters.weights.transactionHistoryByProduct.values?.[product.id] ?? ''}
                                                    onChange={(e) => handleConfigChange(draft => { draft.weights.transactionHistoryByProduct.values[product.id] = parseInt(e.target.value) || 0; })}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell className="font-bold">Sub-Total</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {Object.values(currentParameters.weights.transactionHistoryByProduct.values || {}).reduce((acc, w) => acc + w, 0)}%
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Loan History</CardTitle>
            <CardDescription>Weights for past loan performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             {Object.entries(currentParameters.weights).filter(([key]) => ['loanHistoryCount', 'onTimeRepayments'].includes(key)).map(([key, param]) => (
                <div key={key}>
                    <ParameterToggle
                        label={key}
                        isChecked={param.enabled}
                        onCheckedChange={(checked) => handleConfigChange(draft => { (draft.weights[key as keyof typeof draft.weights] as any).enabled = checked; })}
                        color={themeColor}
                    />
                    <ParameterSlider
                      label="Weight"
                      value={param.value}
                      onValueChange={(v) => handleConfigChange(draft => { (draft.weights[key as keyof typeof draft.weights] as any).value = v[0]; })}
                      isEnabled={param.enabled}
                      color={themeColor}
                    />
                </div>
             ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment &amp; Income</CardTitle>
            <CardDescription>Weights for employment and salary information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div>
                <ParameterToggle
                    label="Salary"
                    isChecked={currentParameters.weights.salary.enabled}
                    onCheckedChange={(checked) => handleConfigChange(draft => { draft.weights.salary.enabled = checked; })}
                    color={themeColor}
                />
                <ParameterSlider
                  label="Weight"
                  value={currentParameters.weights.salary.value}
                  onValueChange={(v) => handleConfigChange(draft => { draft.weights.salary.value = v[0] })}
                  isEnabled={currentParameters.weights.salary.enabled}
                  color={themeColor}
                />
            </div>

            <Separator/>
            
            <div>
                 <ParameterToggle
                    label="Occupation Risk"
                    isChecked={currentParameters.occupationRisk.enabled}
                    onCheckedChange={(checked) => handleConfigChange(draft => { draft.occupationRisk.enabled = checked; })}
                    color={themeColor}
                />
                {currentParameters.occupationRisk.enabled && (
                    <div className="space-y-2 pt-4">
                        <Label>Occupation Risk Levels</Label>
                         <div className="flex space-x-2">
                            <Input 
                                value={newOccupation}
                                onChange={(e) => setNewOccupation(e.target.value)}
                                placeholder="e.g., Engineer"
                            />
                            <Button onClick={handleAddOccupation} style={{backgroundColor: themeColor}} className="text-white">Add</Button>
                        </div>
                        <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                            {Object.entries(currentParameters.occupationRisk.values).map(([occupation, risk]) => (
                                <div key={occupation} className="flex items-center justify-between space-x-2">
                                    <span className="capitalize text-sm flex-1">{occupation}</span>
                                     <Select 
                                        value={risk} 
                                        onValueChange={(v) => handleConfigChange(draft => { draft.occupationRisk.values[occupation] = v as 'Low' | 'Medium' | 'High'; })}
                                     >
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Risk" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveOccupation(occupation)}>
                                        &times;
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

