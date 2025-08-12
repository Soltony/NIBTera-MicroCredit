
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PlusCircle, Trash2, Save, History, Loader2 as Loader } from 'lucide-react';
import type { Rule, ScoringParameter } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScorePreview } from '@/components/loan/score-preview';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { LoanProduct, LoanProvider } from '@/lib/types';
import { useScoringParameters } from '@/hooks/use-scoring-parameters';
import { useScoringHistory, type ScoringHistoryItem } from '@/hooks/use-scoring-history';
import { format } from 'date-fns';
import { produce } from 'immer';

const RuleRow = ({ rule, onUpdate, onRemove, color }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; color?: string; }) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Input
                placeholder="e.g., age"
                value={rule.field}
                onChange={(e) => onUpdate({ ...rule, field: e.target.value })}
                className="w-1/4"
            />
             <Input
                placeholder="e.g., >"
                value={rule.condition}
                onChange={(e) => onUpdate({ ...rule, condition: e.target.value })}
                className="w-1/4"
            />
            <Input
                placeholder="e.g., 30"
                value={rule.value}
                onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                 className="w-1/4"
            />
            <Input
                type="number"
                placeholder="Score"
                value={rule.score}
                onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                 className="w-1/4"
            />
            <Button variant="ghost" size="icon" onClick={onRemove} style={{ color: color }} className="hover:text-white hover:bg-destructive">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

interface CreditScoreEngineClientProps {
    providers: LoanProvider[];
    initialScoringParameters: ScoringParameter[];
}

export function CreditScoreEngineClient({ providers, initialScoringParameters }: CreditScoreEngineClientProps) {
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [parameters, setParameters] = useState<ScoringParameter[]>(initialScoringParameters);
    const [isLoading, setIsLoading] = useState(false);
    
    const { getParametersForProvider: getScoringParams, setAppliedProducts } = useScoringParameters();
    const { getHistoryForProvider, addHistoryItem } = useScoringHistory();

    const [deletingParameterId, setDeletingParameterId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);
    
    const currentParametersForProvider = useMemo(() => {
        return parameters.filter(p => p.providerId === selectedProviderId);
    }, [parameters, selectedProviderId]);

    const selectedProvider = useMemo(() => providers.find(p => p.id === selectedProviderId), [providers, selectedProviderId]);
    const themeColor = selectedProvider?.colorHex || '#fdb913';
    const currentScoringParams = useMemo(() => getScoringParams(selectedProviderId), [getScoringParams, selectedProviderId]);
    const configurationHistory = useMemo(() => selectedProviderId ? getHistoryForProvider(selectedProviderId) : [], [selectedProviderId, getHistoryForProvider]);


    const totalWeight = React.useMemo(() => {
        if (!currentParametersForProvider) return 0;
        return currentParametersForProvider.reduce((sum, param) => sum + param.weight, 0);
    }, [currentParametersForProvider]);

    const handleSave = async () => {
        if (!selectedProviderId || !currentParametersForProvider) return;
        if (totalWeight > 100) {
            toast({
                title: 'Invalid Configuration',
                description: 'The total weight of all parameters cannot exceed 100%.',
                variant: 'destructive',
            });
            return;
        }
        
        setIsLoading(true);
        try {
            const response = await fetch('/api/scoring-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId: selectedProviderId, parameters: currentParametersForProvider }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save parameters.');
            }

            const savedParameters = await response.json();
            
            // Update the local state with the data returned from the server (which includes new IDs)
            setParameters(produce(parameters, draft => {
                // Remove old params for this provider and add the new ones
                const otherProviderParams = draft.filter(p => p.providerId !== selectedProviderId);
                return [...otherProviderParams, ...savedParameters];
            }));
            
            addHistoryItem(selectedProviderId, savedParameters);
            
            if (totalWeight < 100) {
                toast({
                    title: 'Configuration Warning',
                    description: `The total weight is ${totalWeight}%, which is less than 100%. The configuration is saved but may not be optimal.`,
                    variant: 'default',
                });
            } else {
                 toast({
                    title: 'Configuration Saved',
                    description: 'Your credit scoring engine parameters have been successfully saved.',
                });
            }

        } catch (error: any) {
             toast({
                title: 'Error Saving',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateParameter = (paramId: string, updatedData: Partial<ScoringParameter>) => {
        setParameters(produce(draft => {
            const paramIndex = draft.findIndex(p => p.id === paramId);
            if (paramIndex !== -1) {
                draft[paramIndex] = { ...draft[paramIndex], ...updatedData };
            }
        }));
    };

    const handleAddParameter = () => {
        if (!selectedProviderId) return;
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            providerId: selectedProviderId,
            name: 'New Parameter',
            weight: 10,
            rules: [{ id: `rule-${Date.now()}`, field: 'newField', condition: '>', value: '0', score: 10 }],
        };
        setParameters([...parameters, newParam]);
    };

    const handleRemoveParameter = (paramId: string) => {
        setParameters(parameters.filter(p => p.id !== paramId));
        setDeletingParameterId(null);
    };

    const handleAddRule = (paramId: string) => {
         const newRule: Rule = {
            id: `rule-${Date.now()}`,
            field: '',
            condition: '',
            value: '',
            score: 0,
        };
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules.push(newRule);
            }
        }));
    }

    const handleUpdateRule = (paramId: string, ruleId: string, updatedRule: Rule) => {
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                const ruleIndex = param.rules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    param.rules[ruleIndex] = updatedRule;
                }
            }
        }));
    }

    const handleRemoveRule = (paramId: string, ruleId: string) => {
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules = param.rules.filter(r => r.id !== ruleId);
            }
        }));
    }

    const handleLoadHistory = (historyItem: ScoringHistoryItem) => {
        const otherProviderParams = parameters.filter(p => p.providerId !== selectedProviderId);
        setParameters([...otherProviderParams, ...historyItem.parameters]);

        toast({
            title: 'Configuration Loaded',
            description: `Loaded configuration saved on ${format(historyItem.savedAt, 'PPP p')}.`,
        });
    };

    const handleProductSelectionChange = (productId: string, isChecked: boolean) => {
        if (!selectedProviderId) return;
        const currentSelected = currentScoringParams.productIds || [];
        const newSelected = isChecked
          ? [...currentSelected, productId]
          : currentSelected.filter(id => id !== productId);
        setAppliedProducts(selectedProviderId, newSelected);
      };

    if (providers.length === 0) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                    <p className="text-muted-foreground">
                        Define the parameters and rules used to calculate customer credit scores.
                    </p>
                </div>
                 <div className="flex items-center space-x-4">
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
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Total Weight:</span>
                        <span className={`text-lg font-bold ${totalWeight > 100 ? 'text-red-500' : ''}`}>
                            {totalWeight}%
                        </span>
                    </div>
                    <Button onClick={handleSave} style={{ backgroundColor: themeColor }} className="text-white" disabled={isLoading}>
                        {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                    <Button onClick={handleAddParameter} style={{ backgroundColor: themeColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter
                    </Button>
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
                                    checked={currentScoringParams.productIds?.includes(product.id)}
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

            <div className="space-y-4 mt-4">
                {currentParametersForProvider.map((param) => (
                    <Card key={param.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4 w-full">
                                <Input
                                    placeholder="Parameter Name"
                                    value={param.name}
                                    onChange={(e) => handleUpdateParameter(param.id, { name: e.target.value })}
                                    className="text-lg font-semibold w-1/3"
                                />
                                <div className="flex items-center gap-2">
                                     <Label>Weight:</Label>
                                     <Input
                                        type="number"
                                        placeholder="%"
                                        value={param.weight}
                                        onChange={(e) => handleUpdateParameter(param.id, { weight: parseInt(e.target.value) || 0 })}
                                        className="w-20"
                                    />
                                </div>
                            </div>
                             <AlertDialog open={deletingParameterId === param.id} onOpenChange={(isOpen) => !isOpen && setDeletingParameterId(null)}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => setDeletingParameterId(param.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the &quot;{param.name}&quot; parameter and all of its rules.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveParameter(param.id)} style={{ backgroundColor: themeColor }} className="text-white">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible>
                                <AccordionItem value="rules">
                                    <AccordionTrigger>Manage Rules</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                                            <Label className="w-1/4">Field</Label>
                                            <Label className="w-1/4">Condition</Label>
                                            <Label className="w-1/4">Value</Label>
                                            <Label className="w-1/4">Score</Label>
                                        </div>
                                        {param.rules.map((rule) => (
                                           <RuleRow
                                                key={rule.id}
                                                rule={rule}
                                                onUpdate={(updatedRule) => handleUpdateRule(param.id, rule.id, updatedRule)}
                                                onRemove={() => handleRemoveRule(param.id, rule.id)}
                                                color={themeColor}
                                           />
                                        ))}
                                         <Button
                                            variant="outline"
                                            className="mt-2 w-full text-white"
                                            onClick={() => handleAddRule(param.id)}
                                            style={{ backgroundColor: themeColor }}
                                         >
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Configuration History</CardTitle>
                    <CardDescription>
                        Previously saved versions of this provider&apos;s scoring configuration.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {configurationHistory.length > 0 ? (
                        configurationHistory.map((item) => (
                            <Card key={item.id} className="flex items-center justify-between p-3 bg-muted/50">
                                <div>
                                    <p className="font-medium">
                                        Saved on: {format(item.savedAt, 'PPP p')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.parameters.length} parameters, Total Weight: {item.parameters.reduce((s, p) => s + p.weight, 0)}%
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLoadHistory(item)}
                                >
                                    <History className="mr-2 h-4 w-4" />
                                    Load
                                </Button>
                            </Card>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No history found. Save the configuration to create a snapshot.
                        </p>
                    )}
                </CardContent>
             </Card>

             <ScorePreview parameters={currentParametersForProvider} />
        </div>
    );
}
